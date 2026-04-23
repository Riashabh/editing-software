# Wordcut

**AI video editor you control through chat.**

Upload a long video, tell Wordcut what you want — it finds the best moments, cuts clips, adds subtitles, generates animations, and exports — all from a single chat message.

---

## What it does

| You type | What happens |
|---|---|
| "find the best moment" | AI transcribes, finds the highlight, cuts the clip |
| "make it 9:16" | Crops to vertical with face detection |
| "add subtitles" | Transcribes with word-level timing, renders captions |
| "add a hype intro" | GPT-4o writes a Remotion component, renders it, prepends it |
| "find best moment, make it 9:16, add a thank you outro" | All three, sequentially, one message |

The chat panel lives inside the editor — you never leave the screen to keep editing.

---

## Features

- **Chat-based editing** — describe edits in plain English, the AI figures out what to run
- **Multi-step compound requests** — one message can trigger find → crop → subtitle → animate in sequence
- **Context-aware chat** — after a clip is loaded, the AI knows what's already done and won't re-process unless you ask
- **AI clip finding** — GPT-4o-mini analyzes the transcript and picks the most compelling moments
- **Word-level subtitles** — Whisper transcription with karaoke highlight mode, 5 style presets, full custom styling
- **AI animations** — GPT-4o writes a Remotion React component from your prompt, rendered at your clip's actual resolution
- **Subtitle timeline** — scrub, zoom, click to edit any subtitle block
- **Aspect ratio control** — preview and export in Original, 9:16, 16:9, 1:1, or 4:5
- **New session button** — clears everything and cleans temp files in one click

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS |
| Backend | FastAPI, Python 3.9 |
| AI | OpenAI Whisper (transcription), GPT-4o-mini (clip selection), GPT-4o (animation codegen) |
| Video processing | FFmpeg, face detection via OpenCV |
| Animation rendering | Remotion (React → MP4), Node.js child process |

---

## Setup

### Prerequisites
- Python 3.9+
- Node.js 18+
- FFmpeg installed (`brew install ffmpeg` on Mac)
- OpenAI API key

### Backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# add your OPENAI_API_KEY to .env

uvicorn api:app --reload
# runs on http://localhost:8000
```

### Remotion renderer
```bash
cd remotion-renderer
npm install
node render.mjs --help
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# runs on http://localhost:3000
```

---

## How it works

```
Browser
  └─ POST /parse-intent  →  GPT-4o-mini returns ordered steps array
  └─ for each step:
       /process    →  Whisper transcription + GPT moment finding + FFmpeg cut
       /crop       →  FFmpeg aspect ratio crop with face detection
       /add-subtitles  →  Whisper on existing clip, returns word timings
       /animate    →  GPT-4o generates Remotion component → Node renders MP4 → FFmpeg concat
       /export     →  FFmpeg burns subtitles + applies final crop → download
```

Everything is non-destructive until export. Temp files are auto-cleaned after export and on startup if older than 2 hours.

---

## Project structure

```
api.py                    FastAPI backend — all endpoints
Backend/
  analyzer.py             Whisper transcription, GPT moment finder
  editor.py               FFmpeg cut & merge
  extractor.py            Audio extraction
  reframe.py              9:16 vertical crop with face detection
  subtitles.py            SRT/ASS generation, subtitle burning
frontend/
  app/
    page.tsx              Main app — chat, editor, timeline
    components/
      VideoPlayer.tsx     Canvas subtitle renderer
      StylePanel.tsx      Subtitle style controls + export
remotion-renderer/
  render.mjs              Node.js script: takes component code → renders MP4
  src/Root.tsx            Remotion composition root
```
