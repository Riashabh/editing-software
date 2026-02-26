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
    frames = sorted([f"{output_dir}/{f}" for f in os.listdir(output_dir) if f.endswith(".jpg")])
    print(f"Extracted {len(frames)} frames")
    return frames

def extract_audio(video_path, output_path="temp/audio.mp3"):
    os.makedirs("temp", exist_ok=True)
    command = [
        "ffmpeg",
        "-i", video_path,
        "-q:a", "0",
        "-map", "a",
        output_path,
        "-y"
    ]
    subprocess.run(command, check=True)
    print(f"Audio extracted to {output_path}")
    return output_path