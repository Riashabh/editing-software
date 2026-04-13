import json
import os
import re
import shutil
import subprocess
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from Backend.extractor import extract_audio
from Backend.analyzer import transcribe_audio, find_best_moments
from Backend.editor import cut_and_merge
from Backend.reframe import reframe_to_vertical
from Backend.subtitles import (
    generate_srt,
    _srt_timestamp_to_ass,
    _escape_ass_dialogue_text,
    _resolve_ffmpeg_bin,
    _vf_for_burn,
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("temp/clips_out", exist_ok=True)
app.mount("/clips", StaticFiles(directory="temp/clips_out"), name="clips")


# ── helpers ──────────────────────────────────────────────────────────────────

def hex_to_ass(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H00{b.upper()}{g.upper()}{r.upper()}"


def subtitles_to_json(subtitles: list) -> list:
    result = []
    for start, end, text, word_timings in subtitles:
        result.append({"start": start, "end": end, "text": text, "words": word_timings})
    return result


def _seconds_to_srt_ts(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def burn_with_style(video_path: str, srt_path: str, output_path: str, style: "StyleSettings", words_path: str = ""):
    dialogues = []

    if style.karaoke and words_path and os.path.exists(words_path):
        subs = json.load(open(words_path))
        for sub in subs:
            start_ass = _srt_timestamp_to_ass(_seconds_to_srt_ts(sub["start"]))
            end_ass = _srt_timestamp_to_ass(_seconds_to_srt_ts(sub["end"]))
            parts = []
            for w in sub.get("words", []):
                dur_cs = max(1, round((w["end"] - w["start"]) * 100))
                word = _escape_ass_dialogue_text(w["word"])
                parts.append(f"{{\\k{dur_cs}}}{word}")
            body = " ".join(parts)
            if body:
                dialogues.append((start_ass, end_ass, body))
    else:
        raw = open(srt_path, encoding="utf-8", errors="replace").read()
        blocks = re.split(r"\n\s*\n", raw.strip())
        for block in blocks:
            lines = [ln for ln in block.split("\n") if ln.strip()]
            if len(lines) < 2:
                continue
            idx = 1 if re.fullmatch(r"\d+", lines[0].strip()) else 0
            if idx >= len(lines):
                continue
            tm = re.match(
                r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})",
                lines[idx],
            )
            if not tm:
                continue
            body = _escape_ass_dialogue_text("\n".join(lines[idx + 1:]))
            if body:
                dialogues.append((_srt_timestamp_to_ass(tm.group(1)), _srt_timestamp_to_ass(tm.group(2)), body))

    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", video_path],
        capture_output=True, text=True,
    )
    streams = json.loads(probe.stdout)["streams"]
    vs = next(s for s in streams if s["codec_type"] == "video")
    vid_w, vid_h = int(vs["width"]), int(vs["height"])

    font_size = max(16, int((style.fontSize / 100) * vid_h * 0.05))
    outline_color = hex_to_ass(style.outlineColor) if style.outline else "&H00000000"
    outline_w = round(style.outlineWidth * 0.3, 1) if style.outline else 0
    shadow_d = 2 if style.shadow else 0
    margin_v = int((1 - style.positionY / 100) * vid_h)

    if style.karaoke:
        primary = hex_to_ass(style.karaokeColor)
        secondary = hex_to_ass(style.color)
    else:
        primary = hex_to_ass(style.color)
        secondary = "&H000000FF"

    ass_style = (
        f"Style: Default,{style.fontFamily},{font_size},{primary},"
        f"{secondary},{outline_color},&H80000000,1,0,0,0,100,100,0,0,1,{outline_w},{shadow_d},2,20,20,{margin_v},1"
    )
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {vid_w}
PlayResY: {vid_h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{ass_style}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ass_path = srt_path.replace(".srt", "_custom.ass")
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header)
        for s, e, b in dialogues:
            f.write(f"Dialogue: 0,{s},{e},Default,,0,0,0,,{b}\n")

    ffmpeg_bin, filters = _resolve_ffmpeg_bin()
    vf = _vf_for_burn(ass_path, filters)
    subprocess.run([
        ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
        "-i", video_path, "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "copy", output_path,
    ], check=True)


# ── models ───────────────────────────────────────────────────────────────────

class StyleSettings(BaseModel):
    fontFamily: str = "Arial"
    fontSize: int = 100
    color: str = "#ffffff"
    outline: bool = True
    outlineColor: str = "#000000"
    outlineWidth: int = 8
    shadow: bool = True
    positionY: int = 80
    karaoke: bool = False
    karaokeColor: str = "#ffe600"


# ── routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running"}


@app.post("/process")
async def process_video(file: UploadFile = File(...), mode: str = "single", job_id: str = ""):
    input_path = f"temp/{job_id}_input.mp4"
    os.makedirs("temp", exist_ok=True)

    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        audio = extract_audio(input_path)
        transcript = transcribe_audio(audio)
        count = 1 if mode == "single" else 3
        moments = find_best_moments(transcript, count=count)

        if mode == "multi":
            clips = []
            for i, moment in enumerate(moments):
                merged = cut_and_merge(input_path, [moment], output_path=f"temp/{job_id}_clip{i}.mp4")
                vertical = reframe_to_vertical(merged, output_path=f"temp/clips_out/{job_id}_v{i}.mp4")
                srt, sub_data = generate_srt(transcript, [moment], output_path=f"temp/{job_id}_{i}.srt")
                sub_json = subtitles_to_json(sub_data)
                with open(f"temp/{job_id}_{i}_words.json", "w") as wf:
                    json.dump(sub_json, wf)
                clips.append({
                    "video_url": f"/clips/{job_id}_v{i}.mp4",
                    "subtitles": sub_json,
                    "srt_key": f"{job_id}_{i}",
                })
            return {"mode": "multi", "clips": clips}

        else:
            merged = cut_and_merge(input_path, moments, output_path=f"temp/{job_id}_merged.mp4")
            vertical = reframe_to_vertical(merged, output_path=f"temp/clips_out/{job_id}_v.mp4")
            srt, sub_data = generate_srt(transcript, moments, output_path=f"temp/{job_id}.srt")
            sub_json = subtitles_to_json(sub_data)
            with open(f"temp/{job_id}_words.json", "w") as wf:
                json.dump(sub_json, wf)
            return {
                "mode": "single",
                "video_url": f"/clips/{job_id}_v.mp4",
                "subtitles": sub_json,
                "job_id": job_id,
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export")
async def export_video(style: StyleSettings, job_id: str = "", srt_key: str = ""):
    if srt_key:
        video_path = os.path.abspath(f"temp/clips_out/{srt_key.split('_')[0]}_v{srt_key.split('_')[1]}.mp4")
        srt_path = os.path.abspath(f"temp/{srt_key}.srt")
        words_path = os.path.abspath(f"temp/{srt_key}_words.json")
        out_path = os.path.abspath(f"temp/clips_out/{srt_key}_exported.mp4")
    else:
        video_path = os.path.abspath(f"temp/clips_out/{job_id}_v.mp4")
        srt_path = os.path.abspath(f"temp/{job_id}.srt")
        words_path = os.path.abspath(f"temp/{job_id}_words.json")
        out_path = os.path.abspath(f"temp/clips_out/{job_id}_exported.mp4")

    if not os.path.exists(video_path) or not os.path.exists(srt_path):
        raise HTTPException(status_code=404, detail="Files not found. Re-process the video.")

    try:
        burn_with_style(video_path, srt_path, out_path, style, words_path=words_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return FileResponse(out_path, media_type="video/mp4", filename="clip_exported.mp4")
