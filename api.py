import base64
import json
import os
import re
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
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
    allow_origins=["*"],
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
    aspectRatio: str = "original"
    subtitles: list = []

class IntentRequest(BaseModel):
    message: str

@app.post("/parse-intent")
async def parse_intent(req: IntentRequest):
    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Extract video editing intent from the user message. Return ONLY valid JSON:
{
  "action": "find_best_moments" or "crop" or "add_subtitles" or "transcribe" or "animate",
  "count": 1 to 3,
  "aspectRatio": "original" or "9/16" or "16/9" or "1/1" or "4/5",
  "subtitles": true or false,
  "overlay": true or false
}
Rules:
- "find_best_moments": user wants clips, highlights, best parts, viral moments
- "crop": user only mentions aspect ratio or cropping, no AI processing
- "add_subtitles": user wants captions or subtitles burned in
- "transcribe": user wants to see the text/transcript only
- "animate": user wants motion graphics, animations, intro, outro, effects, visuals
- "subtitles": true ONLY if user explicitly mentions subtitles, captions, or text on video
- "overlay": true if animation should go on top of existing clip, false if standalone
Defaults: action=find_best_moments, count=1, aspectRatio=original, subtitles=false, overlay=true"""},
            {"role": "user", "content": req.message}
        ],
        response_format={"type": "json_object"}
    )
    return Response(content=r.choices[0].message.content, media_type="application/json")


# ── routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "running"}


@app.post("/add-subtitles")
async def add_subtitles_to_clip(job_id: str = "", srt_key: str = ""):
    if srt_key:
        parts = srt_key.split("_")
        if len(parts) >= 2:
            # multi clip: srt_key = "jobid_clipindex"
            clip_path = os.path.abspath(f"temp/clips_out/{parts[0]}_v{parts[1]}.mp4")
            video_url = f"/clips/{parts[0]}_v{parts[1]}.mp4"
        else:
            # single clip: srt_key = "jobid"
            clip_path = os.path.abspath(f"temp/clips_out/{srt_key}_v.mp4")
            video_url = f"/clips/{srt_key}_v.mp4"
        out_srt = f"temp/{srt_key}.srt"
        out_words = f"temp/{srt_key}_words.json"
        key = srt_key
    else:
        clip_path = os.path.abspath(f"temp/clips_out/{job_id}_v.mp4")
        out_srt = f"temp/{job_id}.srt"
        out_words = f"temp/{job_id}_words.json"
        video_url = f"/clips/{job_id}_v.mp4"
        key = job_id

    # Prefer animated version if it exists
    base_key = parts[0] if (srt_key and "_" in srt_key) else key
    animated_path = os.path.abspath(f"temp/clips_out/{base_key}_animated.mp4")
    if os.path.exists(animated_path):
        clip_path = animated_path

    if not os.path.exists(clip_path):
        raise HTTPException(status_code=404, detail="Clip not found. Process the video first.")

    try:
        audio = extract_audio(clip_path)
        transcript = transcribe_audio(audio)
        moments = [{"start": transcript.segments[0]["start"], "end": transcript.segments[-1]["end"]}]
        _, sub_data = generate_srt(transcript, moments, output_path=out_srt)
        sub_json = subtitles_to_json(sub_data)
        with open(out_words, "w") as wf:
            json.dump(sub_json, wf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return Response(content=json.dumps({
        "mode": "single",
        "video_url": video_url,
        "subtitles": sub_json,
        "srt_key": key,
    }), media_type="application/json")


@app.post("/crop")
async def crop_video(file: UploadFile = File(...), aspectRatio: str = "9/16", job_id: str = ""):
    input_path = f"temp/{job_id}_input.mp4"
    os.makedirs("temp", exist_ok=True)
    os.makedirs("temp/clips_out", exist_ok=True)
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    out_path = f"temp/clips_out/{job_id}_cropped.mp4"
    crop_map = {
        "16/9": "crop=iw:iw*9/16",
        "1/1":  "crop=min(iw\\,ih):min(iw\\,ih)",
        "4/5":  "crop=ih*4/5:ih",
    }
    try:
        if aspectRatio == "9/16":
            reframe_to_vertical(input_path, output_path=out_path)
        elif aspectRatio in crop_map:
            ffmpeg_bin, _ = _resolve_ffmpeg_bin()
            subprocess.run([
                ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                "-i", input_path, "-vf", crop_map[aspectRatio],
                "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "copy", out_path,
            ], check=True)
        else:
            shutil.copy(input_path, out_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return Response(content=json.dumps({
        "mode": "single",
        "video_url": f"/clips/{job_id}_cropped.mp4",
        "subtitles": [],
        "srt_key": job_id,
        "aspectRatio": aspectRatio,
    }), media_type="application/json")


@app.post("/process")
async def process_video(file: UploadFile = File(...), mode: str = "single", job_id: str = "", count: int = 1, aspectRatio: str = "original", subtitles: bool = False):
    input_path = f"temp/{job_id}_input.mp4"
    os.makedirs("temp", exist_ok=True)

    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        audio = extract_audio(input_path)
        transcript = transcribe_audio(audio)

        # Transcribe only — return text to chat, no cutting
        if mode == "transcribe":
            text = " ".join(seg["text"].strip() for seg in transcript.segments)
            return Response(content=json.dumps({"mode": "transcribe", "transcript": text}), media_type="application/json")

        # Add subtitles to original video — no cutting
        if mode == "add_subtitles":
            out_path = f"temp/clips_out/{job_id}_v.mp4"
            shutil.copy(input_path, out_path)
            srt, sub_data = generate_srt(transcript, [{"start": 0, "end": transcript.segments[-1]["end"]}], output_path=f"temp/{job_id}.srt")
            sub_json = subtitles_to_json(sub_data)
            with open(f"temp/{job_id}_words.json", "w") as wf:
                json.dump(sub_json, wf)
            return Response(content=json.dumps({
                "mode": "single",
                "video_url": f"/clips/{job_id}_v.mp4",
                "subtitles": sub_json,
                "srt_key": job_id,
                "aspectRatio": aspectRatio,
            }), media_type="application/json")

        count = count if mode == "multi" else 1
        moments = find_best_moments(transcript, count=count)

        if mode == "multi":
            def process_clip(i, moment):
                merged = cut_and_merge(input_path, [moment], output_path=f"temp/{job_id}_clip{i}.mp4")
                out_path = f"temp/clips_out/{job_id}_v{i}.mp4"
                shutil.copy(merged, out_path)
                sub_json = []
                if subtitles:
                    _, sub_data = generate_srt(transcript, [moment], output_path=f"temp/{job_id}_{i}.srt")
                    sub_json = subtitles_to_json(sub_data)
                    with open(f"temp/{job_id}_{i}_words.json", "w") as wf:
                        json.dump(sub_json, wf)
                return i, {"video_url": f"/clips/{job_id}_v{i}.mp4", "subtitles": sub_json, "srt_key": f"{job_id}_{i}"}

            with ThreadPoolExecutor(max_workers=3) as executor:
                futures = {executor.submit(process_clip, i, m): i for i, m in enumerate(moments)}
                results = {}
                for f in as_completed(futures):
                    i, clip = f.result()
                    results[i] = clip
            clips = [results[i] for i in sorted(results)]
            return Response(content=json.dumps({"mode": "multi", "clips": clips}), media_type="application/json")

        else:
            merged = cut_and_merge(input_path, moments, output_path=f"temp/{job_id}_merged.mp4")
            out_path = f"temp/clips_out/{job_id}_v.mp4"
            shutil.copy(merged, out_path)

            sub_json = []
            if subtitles:
                _, sub_data = generate_srt(transcript, moments, output_path=f"temp/{job_id}.srt")
                sub_json = subtitles_to_json(sub_data)
                with open(f"temp/{job_id}_words.json", "w") as wf:
                    json.dump(sub_json, wf)
            return Response(content=json.dumps({
                "mode": "single",
                "video_url": f"/clips/{job_id}_v.mp4",
                "subtitles": sub_json,
                "srt_key": job_id,
                "aspectRatio": aspectRatio,
            }), media_type="application/json")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


REMOTION_DIR = os.path.join(os.path.dirname(__file__), "remotion-renderer")
REMOTION_GENERATED = os.path.join(REMOTION_DIR, "src", "Generated.tsx")

ANIMATION_SYSTEM_PROMPT = """You are a world-class motion graphics designer who writes Remotion React components. Create stunning, professional animations.

Strict rules:
- Import ONLY from 'remotion': useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Sequence
- Also import React from 'react'
- Export default function Animation()
- Inline styles ONLY — no CSS modules, no Tailwind, no external CSS
- No external images, fonts, or assets
- No props — component is self-contained
- Valid TypeScript/TSX

Design rules — make it look INCREDIBLE:
- Use spring() for bouncy, energetic entrances
- Layer multiple animated elements (background shapes, text, accent lines)
- Use bold typography: fontSize 80-200px, fontWeight 900
- Use vibrant colors, gradients via multiple overlapping divs, or bold contrast (white on black, etc.)
- Add secondary animated elements: geometric shapes, lines, dots, glows
- Animate opacity, scale, translateY, translateX, rotate for each element with different delays
- Use interpolate() with easing for smooth motion
- Make it feel like a premium social media template, not a basic demo

Output ONLY the component code. No markdown. No explanation."""


@app.post("/animate")
async def animate_video(prompt: str, job_id: str = "", srt_key: str = "", overlay: bool = True, duration: int = 90, fps: int = 30, width: int = 1080, height: int = 1920):
    os.makedirs("temp/clips_out", exist_ok=True)
    out_anim = os.path.abspath(f"temp/clips_out/{job_id}_anim.mp4")

    # Load transcript context if available
    words_path = f"temp/{srt_key or job_id}_words.json" if (srt_key or job_id) else None
    transcript_context = ""
    if words_path and os.path.exists(words_path):
        words = json.load(open(words_path))
        transcript_context = f"\n\nTranscript context: {json.dumps(words[:30])}"

    # Ask Claude to generate the Remotion component
    try:
        msg = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": ANIMATION_SYSTEM_PROMPT},
                {"role": "user", "content": f"{transcript_context}\n\nUser request: {prompt}\n\nDuration: {duration} frames at {fps}fps ({round(duration/fps, 1)}s). Canvas: {width}x{height}px."}
            ]
        )
        component_code = msg.choices[0].message.content.strip()
        # Strip markdown fences if Claude included them
        if component_code.startswith("```"):
            component_code = "\n".join(component_code.split("\n")[1:])
        if component_code.endswith("```"):
            component_code = "\n".join(component_code.split("\n")[:-1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude error: {e}")

    # Write generated component
    with open(REMOTION_GENERATED, "w", encoding="utf-8") as f:
        f.write(component_code)

    code_b64 = base64.b64encode(component_code.encode()).decode()

    # Run Remotion renderer as child process
    render_script = os.path.join(REMOTION_DIR, "render.mjs")
    try:
        result = subprocess.run(
            ["node", render_script,
             "--code", code_b64,
             "--output", out_anim,
             "--duration", str(duration),
             "--fps", str(fps),
             "--width", str(width),
             "--height", str(height)],
            capture_output=True, text=True, cwd=REMOTION_DIR, timeout=120
        )
        if result.returncode != 0 or "RENDER_ERROR" in result.stdout:
            raise HTTPException(status_code=500, detail=f"Render failed: {result.stderr or result.stdout}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Render timed out")

    if overlay and job_id:
        # Find the clip — try srt_key path first, then default
        clip_path = None
        if srt_key:
            parts = srt_key.split("_")
            candidate = os.path.abspath(f"temp/clips_out/{parts[0]}_v{parts[1]}.mp4") if len(parts) >= 2 else os.path.abspath(f"temp/clips_out/{srt_key}_v.mp4")
            if os.path.exists(candidate):
                clip_path = candidate
        if not clip_path:
            candidate = os.path.abspath(f"temp/clips_out/{job_id}_v.mp4")
            if os.path.exists(candidate):
                clip_path = candidate

        if clip_path:
            composited = os.path.abspath(f"temp/clips_out/{job_id}_animated.mp4")
            ffmpeg_bin, _ = _resolve_ffmpeg_bin()
            # Probe clip to get its resolution and fps
            probe = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", clip_path],
                capture_output=True, text=True,
            )
            streams = json.loads(probe.stdout)["streams"]
            vs = next(s for s in streams if s["codec_type"] == "video")
            clip_w, clip_h = int(vs["width"]), int(vs["height"])
            clip_fps = vs.get("r_frame_rate", "30/1")
            # Re-encode both to same resolution/fps before concat
            anim_norm = out_anim.replace(".mp4", "_norm.mp4")
            subprocess.run([
                ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                "-i", out_anim,
                "-vf", f"scale={clip_w}:{clip_h},setsar=1",
                "-r", clip_fps, "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                "-an", anim_norm
            ], check=True)
            # Add silent audio to animation so concat works
            anim_audio = out_anim.replace(".mp4", "_audio.mp4")
            subprocess.run([
                ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                "-i", anim_norm,
                "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
                "-shortest", "-c:v", "copy", "-c:a", "aac", anim_audio
            ], check=True)
            concat_txt = os.path.abspath(f"temp/{job_id}_anim_concat.txt")
            with open(concat_txt, "w") as f:
                f.write(f"file '{anim_audio}'\nfile '{clip_path}'\n")
            subprocess.run([
                ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                "-f", "concat", "-safe", "0", "-i", concat_txt,
                "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", composited
            ], check=True)
            # Carry existing subtitles forward, offset by actual animation duration
            existing_subs = []
            existing_words = os.path.abspath(f"temp/{srt_key or job_id}_words.json")
            anim_probe = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", out_anim],
                capture_output=True, text=True
            )
            anim_probe_data = json.loads(anim_probe.stdout)
            anim_video_stream = next((s for s in anim_probe_data["streams"] if s["codec_type"] == "video"), None)
            anim_duration = float(anim_video_stream.get("duration", duration / fps)) if anim_video_stream else duration / fps
            if os.path.exists(existing_words):
                raw_subs = json.load(open(existing_words))
                for sub in raw_subs:
                    shifted = {
                        "start": sub["start"] + anim_duration,
                        "end": sub["end"] + anim_duration,
                        "text": sub["text"],
                        "words": [{"word": w["word"], "start": w["start"] + anim_duration, "end": w["end"] + anim_duration} for w in sub.get("words", [])]
                    }
                    existing_subs.append(shifted)
            return Response(content=json.dumps({
                "mode": "single", "video_url": f"/clips/{job_id}_animated.mp4", "subtitles": existing_subs, "srt_key": srt_key or job_id
            }), media_type="application/json")

    # Standalone mode
    return Response(content=json.dumps({
        "mode": "single", "video_url": f"/clips/{job_id}_anim.mp4", "subtitles": [], "srt_key": job_id
    }), media_type="application/json")


@app.post("/export")
async def export_video(style: StyleSettings, job_id: str = "", srt_key: str = ""):
    if srt_key and "_" in srt_key:
        parts = srt_key.split("_")
        video_path = os.path.abspath(f"temp/clips_out/{parts[0]}_v{parts[1]}.mp4")
        srt_path = os.path.abspath(f"temp/{srt_key}.srt")
        words_path = os.path.abspath(f"temp/{srt_key}_words.json")
        out_path = os.path.abspath(f"temp/clips_out/{srt_key}_exported.mp4")
    else:
        key = srt_key or job_id
        animated = os.path.abspath(f"temp/clips_out/{key}_animated.mp4")
        video_path = animated if os.path.exists(animated) else os.path.abspath(f"temp/clips_out/{key}_v.mp4")
        srt_path = os.path.abspath(f"temp/{key}.srt")
        words_path = os.path.abspath(f"temp/{key}_words.json")
        out_path = os.path.abspath(f"temp/clips_out/{key}_exported.mp4")

    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found. Re-process the video.")

    has_srt = os.path.exists(srt_path)
    if not has_srt and not style.subtitles:
        return FileResponse(video_path, media_type="video/mp4", filename="clip_exported.mp4")

    try:
        crop_map = {
            "9/16": None,   # handled by reframe_to_vertical
            "16/9": "crop=iw:iw*9/16",
            "1/1":  "crop=min(iw\\,ih):min(iw\\,ih)",
            "4/5":  "crop=ih*4/5:ih",
        }
        if style.subtitles:
            with open(srt_path, "w", encoding="utf-8") as f:
                for idx, sub in enumerate(style.subtitles, 1):
                    f.write(f"{idx}\n")
                    f.write(f"{_seconds_to_srt_ts(sub['start'])} --> {_seconds_to_srt_ts(sub['end'])}\n")
                    f.write(f"{sub['text']}\n\n")

        source = video_path
        if style.aspectRatio == "9/16":
            cropped = out_path.replace(".mp4", "_reframed.mp4")
            reframe_to_vertical(source, output_path=cropped)
            source = cropped
        elif style.aspectRatio in crop_map and crop_map[style.aspectRatio]:
            cropped = out_path.replace(".mp4", "_cropped.mp4")
            ffmpeg_bin, _ = _resolve_ffmpeg_bin()
            subprocess.run(
                [ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                 "-i", source, "-vf", crop_map[style.aspectRatio],
                 "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "copy", cropped],
                check=True,
            )
            source = cropped
        burn_with_style(source, srt_path, out_path, style, words_path=words_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return FileResponse(out_path, media_type="video/mp4", filename="clip_exported.mp4")
