# Wordcut

**AI video editor you control through chat.**

Upload a long video, tell Wordcut what you want — it finds the best moments, cuts clips, adds subtitles, generates animations, and exports — all from a single chat message.

> **Docs:** [Architecture](docs/ARCHITECTURE.md) · [Environment variables](docs/ENVIRONMENT.md) · [Deployment](docs/DEPLOYMENT.md) · [Troubleshooting](docs/TROUBLESHOOTING.md) · [Security](docs/SECURITY.md) · [Contributing](CONTRIBUTING.md)

---

## What it does

| You type | What happens |
|---|---|
| "find the best moment" | Transcribes, finds the highlight, cuts the clip |
| "make it 9:16" | Crops to vertical with face detection |
| "add subtitles" | Transcribes with word-level timing, renders captions |
| "add a hype intro" | GPT writes a Remotion component, renders it, prepends it |
| "find best moment, make it 9:16, add a thank you outro" | All three, sequentially, one message |

The chat panel lives inside the editor — you never leave the screen to keep editing.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 (deployed on Vercel) |
| Backend | FastAPI, Python 3.11 (Docker) / 3.9+ (local), uvicorn |
| Transcription | **Groq** Whisper (`whisper-large-v3-turbo`) — word + segment timestamps |
| Clip selection & intent | OpenAI **GPT-4o-mini** |
| Animation codegen | OpenAI **GPT-4o** → Remotion (React → MP4) |
| Video processing | FFmpeg (+ **libass** for subtitle burn-in), OpenCV (face detection) |
| Animation rendering | Remotion 4 + headless Chromium, invoked as a Node subprocess |
| Storage | Cloudflare R2 (S3-compatible, via boto3) — optional; falls back to local |

> The README previously credited transcription to "OpenAI Whisper" — it is actually **Groq** Whisper. See [analyzer.py](backend/app/pipeline/analyzer.py).

---

## Quick start

### Prerequisites
- Python 3.9+ (3.11 in production) and Node.js 18+
- **FFmpeg built with libass** — see the note below, this is the #1 setup gotcha
- An OpenAI API key and a Groq API key

> ⚠️ **macOS FFmpeg / libass gotcha:** subtitle burn-in (`/export`) needs an FFmpeg build that has the `ass`/`subtitles` filters (libass). The Apple Command Line Tools FFmpeg and some Homebrew builds ship **without** libass, which makes export crash. Verify with `ffmpeg -h filter=ass` and see [Troubleshooting](docs/TROUBLESHOOTING.md#ffmpeg--libass) for the fix.

### 1. Backend
```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env          # then fill in OPENAI_API_KEY and GROQ_API_KEY
uvicorn backend.app.main:app --reload      # http://localhost:8000
```

### 2. Remotion renderer (one-time install, no server)
```bash
cd remotion-renderer
npm install --legacy-peer-deps
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000.

See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) for every environment variable and which features need which keys.

---

## How it works

```
Browser
  └─ POST /parse-intent   →  GPT-4o-mini returns an ordered steps array
  └─ for each step, the frontend calls the matching endpoint:
       /process       →  Groq Whisper transcription + GPT moment finding + FFmpeg cut
       /crop          →  FFmpeg aspect-ratio crop (9:16 uses OpenCV face detection)
       /add-subtitles →  Whisper on an existing clip, returns word timings
       /animate       →  GPT-4o writes a Remotion component → Node renders MP4 → FFmpeg concat
       /export        →  FFmpeg burns subtitles + applies final crop → download (or R2 URL)
```

Processing is non-destructive until export. Temp files are cleaned on startup (older than 2 hours) and per-job during export. The full request/response contract for each endpoint is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#http-api).

---

## Testing

A fast, deterministic test suite covers every endpoint. External services (OpenAI, Groq,
R2, the Remotion/Node renderer) are mocked; FFmpeg runs for real on tiny generated clips —
so the suite needs no API keys, costs nothing, and runs in seconds. Run it before every push.

```bash
pip install -r requirements-dev.txt
pytest                      # 29 tests, ~2s
```

Tests that burn subtitles require an FFmpeg built with libass; they skip automatically if it
isn't present. See [CONTRIBUTING.md](CONTRIBUTING.md) for how the mocking is structured.

---

## Project structure

```
backend/
  app/
    main.py               FastAPI backend — all HTTP endpoints + subtitle burner
    pipeline/
      analyzer.py         Groq Whisper transcription, GPT moment finder
      editor.py           FFmpeg cut & merge
      extractor.py        Audio extraction
      reframe.py          9:16 vertical crop with OpenCV face detection
      storage.py          Cloudflare R2 upload + presigned URLs
      subtitles.py        SRT/ASS generation, FFmpeg/libass resolution, subtitle burning
frontend/
  app/page.tsx            Main app — chat, editor, timeline, export
  app/components/         VideoPlayer (canvas subtitle preview), StylePanel, icons
  app/how-it-works/       Marketing / explainer page
remotion-renderer/
  render.mjs              Node script: GPT-generated component code → MP4
  src/index.tsx           Remotion composition root
scripts/                  CLI driver (cli.py) + R2 upload utility
tests/                    pytest suite — unit + endpoint integration tests
docs/                     Architecture, environment, deployment, security, troubleshooting
Dockerfile                Backend image (Python + FFmpeg + Node + Chromium)
requirements.txt          Runtime deps · requirements-dev.txt adds pytest
```

---

## Status & known issues

This is an early-stage project. Before exposing the backend publicly, read [docs/SECURITY.md](docs/SECURITY.md) — there is **no authentication** on the API yet, and several endpoints accept client-controlled identifiers and URLs that need hardening (path-traversal validation, SSRF allow-lists). These are tracked as a prioritized backlog.
