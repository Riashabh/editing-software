import os
import sys
import shutil

from Backend.extractor import extract_audio
from Backend.analyzer import transcribe_audio, find_best_moments
from Backend.editor import cut_and_merge
from Backend.reframe import reframe_to_vertical
from Backend.subtitles import generate_srt, burn_subtitles


video = sys.argv[1] if len(sys.argv) > 1 else "test.mp4"

try: 
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

    print("Step 5: Generating subtitles...")
    srt = generate_srt(transcript, moments)

    print("Step 6: Burning subtitles...")
    output_subtitled = burn_subtitles(vertical, srt)
    print(f"Final video with subtitles: {output_subtitled}")

    shutil.rmtree("temp", ignore_errors=True)
    os.remove(output)
    os.remove(vertical)
    print("Cleaned up temp files.")

except FileNotFoundError as e:
    print(f"[ERROR] File not found: {e}")
    sys.exit(1)
except RuntimeError as e:
    print(f"[ERROR] Pipeline failed: {e}")
    sys.exit(1)


