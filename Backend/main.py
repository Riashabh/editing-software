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

print("Step 6: Burning subtitles...")
output_subtitled = burn_subtitles(vertical, srt)

print(f"Final video with subtitles: {output_subtitled}")