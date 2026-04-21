import subprocess
import os

def extract_frames(video_path, output_dir="temp/frames", interval=2):
    os.makedirs(output_dir, exist_ok=True)
    command = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"fps=1/{interval}",
        f"{output_dir}/frame_%04d.jpg",
        "-y"
    ]
    subprocess.run(command, check=True)
    frames = sorted([
        f"{output_dir}/{f}" 
        for f in os.listdir(output_dir) 
        if f.endswith(".jpg")
    ])
    print(f"Extracted {len(frames)} frames")
    return frames

def extract_audio(video_path, output_path="temp/audio.mp3"):
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    os.makedirs("temp", exist_ok=True)
    command = ["ffmpeg", "-i", video_path, "-ac", "1", "-ar", "16000", "-map", "a", output_path, "-y"]

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed:\n{result.stderr}")
    print(f"Audio extracted to {output_path}")
    return output_path
