import os
import shutil
import uuid
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from Backend.extractor import extract_audio
from Backend.analyzer import transcribe_audio, find_best_moments
from Backend.editor import cut_and_merge
from Backend.reframe import reframe_to_vertical
from Backend.subtitles import generate_srt, burn_subtitles

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("temp/clips_out", exist_ok=True)
app.mount("/clips", StaticFiles(directory="temp/clips_out"), name="clips")

@app.get("/")
def root():
    return {"status": "running"}

@app.post("/process")
async def process_video(file: UploadFile = File(...), mode: str = "single"):
    job_id = str(uuid.uuid4())[:8]
    input_path = f"temp/{job_id}_input.mp4"
    os.makedirs("temp", exist_ok=True)

    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        audio = extract_audio(input_path)
        transcript = transcribe_audio(audio)
        count = 1 if mode == "single" else 3
        moments = find_best_moments(transcript, count=count)

        if mode == "multi":
            urls = []
            for i, moment in enumerate(moments):
                merged = cut_and_merge(input_path, [moment], output_path=f"temp/{job_id}_clip{i}.mp4")
                vertical = reframe_to_vertical(merged, output_path=f"temp/{job_id}_vertical{i}.mp4")
                srt = generate_srt(transcript, [moment], output_path=f"temp/{job_id}_{i}.srt")
                final_clip = burn_subtitles(vertical, srt, output_path=f"temp/clips_out/{job_id}_final{i}.mp4")
                urls.append(f"/clips/{job_id}_final{i}.mp4")
            return {"clips": urls}

        else:
            merged = cut_and_merge(input_path, moments, output_path=f"temp/{job_id}_merged.mp4")
            vertical = reframe_to_vertical(merged, output_path=f"temp/{job_id}_vertical.mp4")
            srt = generate_srt(transcript, moments, output_path=f"temp/{job_id}.srt")
            final = burn_subtitles(vertical, srt, output_path=f"temp/clips_out/{job_id}_output.mp4")
            return FileResponse(final, media_type="video/mp4", filename="output.mp4")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
