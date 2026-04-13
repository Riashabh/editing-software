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
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    with open(audio_path, "rb") as audio_file:
        try:
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"]
            )
        except Exception as e:
            raise RuntimeError(f"Whisper transcription failed: {e}")
    print("Transcription done!")
    return transcript


def find_best_moments(transcript, count=1):
    print("Finding best moments with GPT-4o...")
    formatted = ""
    for segment in transcript.segments:
        start = round(segment.start, 2)
        end = round(segment.end, 2)
        formatted += f"[{start}s - {end}s]: {segment.text}\n"
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": f"You are a video editor specializing in short-form content. Analyze this podcast transcript and find the {count} most compelling moment(s) — funniest, most insightful, or most emotional. Each clip MUST be between 30 and 45 seconds long. Return ONLY a JSON array like: [{{\"start\": 10.5, \"end\": 45.2, \"reason\": \"why this moment is good\"}}]. Never return a clip shorter than 30s or longer than 45s."},
                {"role": "user", "content": formatted}
            ]
        )
    except Exception as e:
        raise RuntimeError(f"GPT-4o analysis failed: {e}")
    
    content = response.choices[0].message.content
    content = content.replace("```json", "").replace("```", "").strip()
    try:
        moments = json.loads(content)
    except json.JSONDecodeError:
        raise RuntimeError(f"GPT-4o returned invalid JSON: {content}")
    
        # Enforce 30-45 second clip length
    enforced = []
    for m in moments:
        duration = m["end"] - m["start"]
        if duration > 45:
            m["end"] = m["start"] + 40  # trim to 40s
        elif duration < 30:
            m["end"] = m["start"] + 30  # extend to 30s
        enforced.append(m)

    print(f"Found {len(enforced)} best moments")
    return enforced

