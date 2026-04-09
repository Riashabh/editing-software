import subprocess
import os

def reframe_to_vertical(video_path, output_path="output_vertical.mp4"):
    os.makedirs("temp", exist_ok=True)
    
    command = [
        "ffmpeg",
        "-i", video_path,
        "-vf", "crop=ih*9/16:ih:(iw-ih*9/16)/2:0",
        "-c:v", "libx264",
        "-c:a", "aac",
        output_path,
        "-y"
    ]
    subprocess.run(command, check=True)
    print(f"Reframed to vertical: {output_path}")
    return output_path