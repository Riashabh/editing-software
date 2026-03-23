import json
import os
import subprocess
from types import SimpleNamespace

from analyzer import find_best_moments, transcribe_audio
from editor import cut_and_merge
from extractor import extract_audio
from reframe import reframe_to_vertical
from subtitles import burn_subtitles, generate_srt


def build_highlight_transcript(full_transcript, moments):
    """
    Rebase transcript timestamps from source timeline to merged-highlight timeline.
    """
    rebased_segments = []
    merged_cursor = 0.0

    for moment in moments:
        clip_start = float(moment["start"])
        clip_end = float(moment["end"])
        clip_duration = max(0.0, clip_end - clip_start)
        if clip_duration <= 0:
            continue

        for seg in full_transcript.segments:
            seg_start = float(seg.start)
            seg_end = float(seg.end)
            overlap_start = max(seg_start, clip_start)
            overlap_end = min(seg_end, clip_end)
            if overlap_end <= overlap_start:
                continue

            rebased_start = merged_cursor + (overlap_start - clip_start)
            rebased_end = merged_cursor + (overlap_end - clip_start)
            text = (seg.text or "").strip()
            if not text:
                continue

            rebased_segments.append(
                SimpleNamespace(start=rebased_start, end=rebased_end, text=text)
            )

        merged_cursor += clip_duration

    return SimpleNamespace(segments=rebased_segments)


def build_word_captions(highlight_transcript):
    """
    Build per-word timings from segment timings.

    Whisper word-level timestamps can be plugged in later. For now, this splits each segment
    duration evenly across words so Remotion can animate word-by-word highlighting.
    """
    words = []
    for seg in highlight_transcript.segments:
        text = (seg.text or "").strip()
        tokens = [t for t in text.split() if t]
        if not tokens:
            continue

        seg_start = float(seg.start)
        seg_end = float(seg.end)
        seg_duration = max(0.05, seg_end - seg_start)
        step = seg_duration / max(1, len(tokens))
        cursor = seg_start

        for token in tokens:
            w_start = cursor
            w_end = min(seg_end, cursor + step)
            words.append(
                {
                    "start": round(w_start, 3),
                    "end": round(max(w_start + 0.03, w_end), 3),
                    "text": token,
                }
            )
            cursor += step

    return words


def get_video_duration_seconds(video_path):
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    result = subprocess.run(cmd, check=True, capture_output=True, text=True)
    return float(result.stdout.strip())


def render_with_remotion(video_path, highlight_transcript, output_path="output_subtitled.mp4"):
    project_root = os.path.dirname(os.path.abspath(__file__))
    remotion_dir = os.path.join(project_root, "remotion-renderer")
    input_json_path = os.path.join(project_root, "temp", "remotion-input.json")

    if not os.path.isdir(remotion_dir):
        raise RuntimeError(
            "remotion-renderer folder not found. Setup first: mkdir remotion-renderer + npm install"
        )

    words = build_word_captions(highlight_transcript)
    duration_sec = get_video_duration_seconds(video_path)
    payload = {
        "videoPath": os.path.abspath(video_path),
        "outputPath": os.path.abspath(output_path),
        "captions": words,
        "width": 608,
        "height": 1080,
        "fps": 30,
        "durationInFrames": int(duration_sec * 30),
    }

    os.makedirs(os.path.dirname(input_json_path), exist_ok=True)
    with open(input_json_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=True)

    print("Rendering subtitles with Remotion...")
    cmd = ["node", "render.mjs", input_json_path]
    subprocess.run(cmd, check=True, cwd=remotion_dir)
    return output_path


video = "test.mp4"

print("Step 1: Extracting audio...")
audio = extract_audio(video)

print("Step 2: Transcribing + analyzing...")
transcript = transcribe_audio(audio)
moments = find_best_moments(transcript)

for m in moments:
    print(f"- {m['start']}s to {m['end']}s — {m['reason']}")

print("Step 3: Cutting and merging clips...")
output = cut_and_merge(video, moments)
print(f"Final video: {output}")

print("Step 4: Reframing to vertical...")
vertical = reframe_to_vertical(output)

print("Step 5: Building highlight timeline transcript...")
highlight_transcript = build_highlight_transcript(transcript, moments)
srt = generate_srt(highlight_transcript)
print(f"Debug SRT file: {srt}")

print("Step 6: Rendering subtitle video...")
try:
    output_subtitled = render_with_remotion(vertical, highlight_transcript)
except Exception as err:
    print(f"Remotion render failed, falling back to ffmpeg subtitle path: {err}")
    output_subtitled = burn_subtitles(vertical, srt)

print(f"Final video with subtitles: {output_subtitled}")