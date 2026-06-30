import subprocess
import os
import cv2

def _detect_face_x(video_path):
    """Sample frames and return average face center X position (normalized 0-1)."""
    cap = cv2.VideoCapture(video_path)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    
    # Sample one frame every 2 seconds
    sample_interval = max(1, int(fps * 2))
    x_positions = []
    
    for frame_idx in range(0, total_frames, sample_interval):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            continue
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
        for (x, y, w, h) in faces:
            center_x = x + w / 2
            x_positions.append(center_x / width)  # normalize to 0-1
    
    cap.release()
    
    if not x_positions:
        print("No face detected, defaulting to center crop")
        return 0.5
    
    avg = sum(x_positions) / len(x_positions)
    print(f"Face detected at avg X position: {avg:.2f}")
    return avg


def reframe_to_vertical(video_path, output_path="output_vertical.mp4"):
    os.makedirs("temp", exist_ok=True)

    # Get video dimensions
    import json
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", video_path],
        capture_output=True, text=True
    )
    streams = json.loads(probe.stdout)["streams"]
    video_stream = next(s for s in streams if s["codec_type"] == "video")
    iw = int(video_stream["width"])
    ih = int(video_stream["height"])

    crop_w = int(ih * 9 / 16)
    face_x = _detect_face_x(video_path)

    # Calculate crop X, clamped so we don't go out of bounds
    ideal_x = int(face_x * iw - crop_w / 2)
    crop_x = max(0, min(ideal_x, iw - crop_w))

    print(f"Cropping: width={crop_w}, x_offset={crop_x}")

    command = [
        "ffmpeg",
        "-i", video_path,
        "-vf", f"crop={crop_w}:{ih}:{crop_x}:0",
        "-c:v", "libx264",
        "-c:a", "aac",
        output_path,
        "-y"
    ]
    subprocess.run(command, check=True)
    print(f"Reframed to vertical: {output_path}")
    return output_path
