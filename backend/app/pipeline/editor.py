import subprocess
import os

def cut_and_merge(video_path, moments, output_path="output.mp4"):
    os.makedirs("temp/clips", exist_ok=True)
    clip_paths = []

    for i, moment in enumerate(moments):
        start = moment["start"]
        end = moment["end"]
        duration = end - start
        clip_path = output_path.replace(".mp4", f"_seg{i}.mp4")

        command = [
            "ffmpeg",
            "-ss", str(start),
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264", "-preset", "ultrafast",
            "-c:a", "aac",
            "-avoid_negative_ts", "make_zero",
            clip_path,
            "-y"
        ]


        subprocess.run(command, check=True)
        clip_paths.append(clip_path)
        print(f"Cut clip {i+1}: {start}s to {end}s")

    # write concat file
    concat_file = output_path.replace(".mp4", "_concat.txt")
    with open(concat_file, "w") as f:
        for clip_path in clip_paths:
            f.write(f"file '../{clip_path}'\n")

    # merge all clips
    command = [
        "ffmpeg",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path,
        "-y"
    ]
    subprocess.run(command, check=True)
    print(f"Done! Output saved to {output_path}")
    return output_path