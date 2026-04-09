import os
import json
import base64
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
# Temporary debug override: hardcode key to verify credential validity.
# Move this back to os.getenv("OPENAI_API_KEY") after confirming.
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def transcribe_audio(audio_path):
    print("Transcribing audio with Whisper...")
    with open(audio_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"]
        )
    print("Transcription done!")
    return transcript

def find_best_moments(transcript):
    print("Finding best moments with GPT-4o...")
    
    # format transcript with timestamps
    formatted = ""
    for segment in transcript.segments:
        start = round(segment.start, 2)
        end = round(segment.end, 2)
        formatted += f"[{start}s - {end}s]: {segment.text}\n"
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "system",
                "content": "You are a video editor. Analyze this podcast transcript and find the 3 most compelling moments — funniest, most insightful, or most emotional. Return ONLY a JSON array like: [{\"start\": 10.5, \"end\": 45.2, \"reason\": \"why this moment is good\"}]"
            },
            {
                "role": "user",
                "content": formatted
            }
        ]
    )
    
    content = response.choices[0].message.content
    content = content.replace("```json", "").replace("```", "").strip()
    moments = json.loads(content)
    print(f"Found {len(moments)} best moments")
    return moments