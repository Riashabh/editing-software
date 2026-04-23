import base64
import glob
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


def _clean_temp():
    for folder in ["temp/clips_out", "temp"]:
        if os.path.exists(folder):
            for f in os.listdir(folder):
                p = os.path.join(folder, f)
                if os.path.isfile(p):
                    try: os.remove(p)
                    except: pass

def _clean_old_temp(max_age_hours: float = 2):
    import time
    now = time.time()
    for folder in ["temp/clips_out", "temp"]:
        if os.path.exists(folder):
            for f in os.listdir(folder):
                p = os.path.join(folder, f)
                if os.path.isfile(p) and (now - os.path.getmtime(p)) / 3600 > max_age_hours:
                    try: os.remove(p)
                    except: pass

_clean_old_temp()
os.makedirs("temp/clips_out", exist_ok=True)
app.mount("/clips", StaticFiles(directory="temp/clips_out"), name="clips")


@app.post("/cleanup")
def cleanup():
    _clean_temp()
    os.makedirs("temp/clips_out", exist_ok=True)
    return {"status": "cleaned"}


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
    context: dict = {}

@app.post("/parse-intent")
async def parse_intent(req: IntentRequest):
    ctx = req.context
    context_prefix = ""
    if ctx.get("hasActiveClip"):
        subs = f"has {ctx.get('subtitleCount', 0)} subtitle lines" if ctx.get("hasSubtitles") else "no subtitles yet"
        mode_info = ctx.get("clipMode", "single")
        if mode_info == "multi":
            mode_info += f" ({ctx.get('clipCount', 1)} clips)"
        context_prefix = (
            f"[EDITOR STATE: user has an active clip open — {mode_info} mode, {subs}. "
            f"Treat requests like 'add subtitles/captions', 'make it vertical', 'add animation', 'change ratio' as operations on THIS clip. "
            f"Only use find_best_moments if the user clearly wants new/different clips (e.g. 'find another moment', 'get me 3 clips').]\n\n"
        )

    r = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": """Extract video editing intent from the user message. Return ONLY valid JSON with a steps array:
{
  "steps": [
    {
      "action": "find_best_moments" | "crop" | "add_subtitles" | "transcribe" | "animate",
      "count": 1 to 3,
      "aspectRatio": "original" | "9/16" | "16/9" | "1/1" | "4/5",
      "subtitles": true | false,
      "overlay": true | false,
      "position": number
    }
  ]
}

Action rules:
- "find_best_moments": user wants new clips selected from source video
- "crop": user only wants aspect ratio change on existing clip, no AI
- "add_subtitles": user wants captions or subtitles on existing clip
- "transcribe": user wants to see transcript text only
- "animate": user wants motion graphics, intro, outro, title card, any animation
- "revert": user wants to undo/remove the last animation or go back to the original clip

Field rules:
- "subtitles": true ONLY if user explicitly asks for subtitles/captions
- "overlay": true if animation goes on existing clip, false if standalone
- "position": 0 = start/intro, -1 = end/outro, any other number = timestamp in seconds
- "aspectRatio": only include if user specifies a ratio
- "count": only for find_best_moments, default 1

Multi-step rules:
- If user asks for multiple things, return multiple steps in logical order
- find_best_moments or crop always comes before add_subtitles or animate
- crop and transcribe are always standalone (single step)
- Example: "find best moment, make it 9:16, add outro" → [{find_best_moments, aspectRatio:9/16}, {animate, position:-1}]
- Example: "find 3 clips with subtitles" → [{find_best_moments, count:3, subtitles:true}]
- Example: "add an intro animation" → [{animate, position:0}]
- "sub", "subs", "captions", "cc" all mean add_subtitles

Defaults per step: count=1, aspectRatio=original, subtitles=false, overlay=true, position=0"""},
            {"role": "user", "content": f"{context_prefix}{req.message}"}
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
async def animate_video(prompt: str, job_id: str = "", srt_key: str = "", overlay: bool = True, position: float = 0, duration: int = 90, fps: int = 30, width: int = 1080, height: int = 1920):
    os.makedirs("temp/clips_out", exist_ok=True)
    out_anim = os.path.abspath(f"temp/clips_out/{job_id}_anim.mp4")
    ffmpeg_bin, _ = _resolve_ffmpeg_bin()

    # ── 1. Find clip & probe its actual dimensions first ──────────────────────
    clip_path = None
    if overlay and job_id:
        if srt_key:
            parts = srt_key.split("_")
            candidate = (os.path.abspath(f"temp/clips_out/{parts[0]}_v{parts[1]}.mp4") if len(parts) >= 2
                         else os.path.abspath(f"temp/clips_out/{srt_key}_v.mp4"))
            if os.path.exists(candidate):
                clip_path = candidate
        if not clip_path:
            candidate = os.path.abspath(f"temp/clips_out/{job_id}_v.mp4")
            if os.path.exists(candidate):
                clip_path = candidate
        if not clip_path:
            raise HTTPException(status_code=404, detail="Clip not found — process your video first before adding an animation.")

        probe = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", clip_path],
            capture_output=True, text=True,
        )
        streams = json.loads(probe.stdout)["streams"]
        vs = next(s for s in streams if s["codec_type"] == "video")
        width, height = int(vs["width"]), int(vs["height"])
        clip_fps = vs.get("r_frame_rate", "30/1")

    # ── 2. Load transcript context ────────────────────────────────────────────
    words_path = f"temp/{srt_key or job_id}_words.json" if (srt_key or job_id) else None
    transcript_context = ""
    if words_path and os.path.exists(words_path):
        words = json.load(open(words_path))
        transcript_context = f"\n\nTranscript context: {json.dumps(words[:30])}"

    # ── 3. Generate Remotion component with correct canvas size ───────────────
    try:
        msg = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": ANIMATION_SYSTEM_PROMPT},
                {"role": "user", "content": f"{transcript_context}\n\nUser request: {prompt}\n\nDuration: {duration} frames at {fps}fps ({round(duration/fps, 1)}s). Canvas: {width}x{height}px ({'portrait/vertical' if height > width else 'landscape/horizontal'})."}
            ]
        )
        component_code = msg.choices[0].message.content.strip()
        if component_code.startswith("```"):
            component_code = "\n".join(component_code.split("\n")[1:])
        if component_code.endswith("```"):
            component_code = "\n".join(component_code.split("\n")[:-1])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GPT error: {e}")

    with open(REMOTION_GENERATED, "w", encoding="utf-8") as f:
        f.write(component_code)

    code_b64 = base64.b64encode(component_code.encode()).decode()

    # ── 4. Render animation ───────────────────────────────────────────────────
    render_script = os.path.join(REMOTION_DIR, "render.mjs")
    try:
        render_result = subprocess.run(
            ["node", render_script,
             "--code", code_b64, "--output", out_anim,
             "--duration", str(duration), "--fps", str(fps),
             "--width", str(width), "--height", str(height)],
            capture_output=True, text=True, cwd=REMOTION_DIR, timeout=120
        )
        if render_result.returncode != 0 or "RENDER_ERROR" in render_result.stdout:
            raise HTTPException(status_code=500, detail=f"Render failed: {render_result.stderr or render_result.stdout}")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Render timed out")

    # ── 5. Composite onto clip ────────────────────────────────────────────────
    if clip_path:
        composited = os.path.abspath(f"temp/clips_out/{job_id}_animated.mp4")

        # Normalize animation to clip resolution/fps, add silent audio
        anim_norm = out_anim.replace(".mp4", "_norm.mp4")
        anim_audio = out_anim.replace(".mp4", "_audio.mp4")
        subprocess.run([
            ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
            "-i", out_anim, "-vf", f"scale={width}:{height},setsar=1",
            "-r", clip_fps, "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-an", anim_norm
        ], check=True)
        subprocess.run([
            ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
            "-i", anim_norm, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
            "-shortest", "-c:v", "copy", "-c:a", "aac", anim_audio
        ], check=True)

        # Probe actual rendered animation duration
        ap = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", out_anim],
            capture_output=True, text=True
        )
        avs = next((s for s in json.loads(ap.stdout)["streams"] if s["codec_type"] == "video"), None)
        anim_duration = float(avs.get("duration", duration / fps)) if avs else duration / fps

        concat_txt = os.path.abspath(f"temp/{job_id}_anim_concat.txt")
        if position > 0:
            part1 = os.path.abspath(f"temp/{job_id}_part1.mp4")
            part2 = os.path.abspath(f"temp/{job_id}_part2.mp4")
            subprocess.run([ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                "-i", clip_path, "-t", str(position),
                "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", part1], check=True)
            subprocess.run([ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
                "-i", clip_path, "-ss", str(position),
                "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", part2], check=True)
            with open(concat_txt, "w") as f:
                f.write(f"file '{part1}'\nfile '{anim_audio}'\nfile '{part2}'\n")
        elif position < 0:
            with open(concat_txt, "w") as f:
                f.write(f"file '{clip_path}'\nfile '{anim_audio}'\n")
        else:
            with open(concat_txt, "w") as f:
                f.write(f"file '{anim_audio}'\nfile '{clip_path}'\n")

        subprocess.run([
            ffmpeg_bin, "-y", "-hide_banner", "-loglevel", "error",
            "-f", "concat", "-safe", "0", "-i", concat_txt,
            "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-c:a", "aac", composited
        ], check=True)

        existing_subs = []
        existing_words = os.path.abspath(f"temp/{srt_key or job_id}_words.json")
        if os.path.exists(existing_words):
            raw_subs = json.load(open(existing_words))
            insert_at = position if position >= 0 else float("inf")
            for sub in raw_subs:
                offset = anim_duration if sub["start"] >= insert_at else 0
                existing_subs.append({
                    "start": sub["start"] + offset,
                    "end": sub["end"] + offset,
                    "text": sub["text"],
                    "words": [{"word": w["word"], "start": w["start"] + offset, "end": w["end"] + offset} for w in sub.get("words", [])]
                })
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

    key = (srt_key.split("_")[0] if (srt_key and "_" in srt_key) else (srt_key or job_id))
    for pattern in [f"temp/{key}*", f"temp/clips_out/{key}*"]:
        for f in glob.glob(pattern):
            if os.path.abspath(f) != out_path:   # ← was just: f != out_path
                try: os.remove(f)
                except: pass


    return FileResponse(out_path, media_type="video/mp4", filename="clip_exported.mp4")
