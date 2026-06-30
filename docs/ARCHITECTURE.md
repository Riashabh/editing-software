# Architecture

Wordcut is a chat-driven short-form video editor. A Next.js frontend turns a user's
plain-English instruction into an ordered list of steps, then calls a FastAPI backend
endpoint for each step. The backend runs an FFmpeg-based pipeline (transcribe → find
moments → cut → reframe → subtitle → animate → export), stores results on Cloudflare R2
(or locally), and returns URLs the browser plays and downloads.

```
┌──────────────┐   parse-intent    ┌─────────────────────────────────────────┐
│   Frontend   │ ────────────────► │              Backend (FastAPI)            │
│ Next.js 16   │ ◄──── steps[] ─── │  backend/app/main.py + backend/app/pipeline/*.py                     │
│ page.tsx     │                   │                                            │
│              │  per-step calls   │  ┌─────────┐  ┌────────┐  ┌─────────────┐ │
│  VideoPlayer │ ────────────────► │  │ Groq    │  │ OpenAI │  │ FFmpeg /    │ │
│  (canvas     │   /process        │  │ Whisper │  │ GPT-4o │  │ ffprobe     │ │
│   subtitle   │   /crop           │  └─────────┘  └────────┘  └─────────────┘ │
│   preview)   │   /add-subtitles  │  ┌──────────────┐  ┌──────────────────┐   │
│              │   /animate        │  │ OpenCV face  │  │ Remotion (Node +  │   │
│              │   /export         │  │ detection    │  │ headless Chromium)│   │
└──────────────┘ ◄── clip URLs ─── │  └──────────────┘  └──────────────────┘   │
        │                          │            │ temp/ working tree           │
        │  GET clip / download     │            ▼                              │
        └────────────────────────► │     Cloudflare R2 (or /clips static)      │
                                    └─────────────────────────────────────────┘
```

## Components

### Frontend (`frontend/`)
- **`app/page.tsx`** — the whole application in one ~1440-line client component. Holds the
  `view` state machine (`"chat" | "editor"`), the chat log, the dual-track timeline
  (`Segment[]`), and the chat→pipeline orchestration (`handleSend` → `/parse-intent` →
  loop `executeStep` over the returned steps). API base is
  `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"`.
- **`app/components/VideoPlayer.tsx`** — HTML5 `<video>` with a transparent `<canvas>`
  overlay that draws subtitles live (a `requestAnimationFrame` loop reads `currentTime`).
  This is an *independent* implementation of subtitle layout from the backend's libass
  burn, so the preview can diverge slightly from the exported MP4.
- **`app/components/StylePanel.tsx`** — subtitle style editor; exports the `Subtitle`,
  `SubStyle` interfaces and `DEFAULT_STYLE` used across the app.
- **`app/how-it-works/page.tsx`** — static marketing/explainer page.

### Backend (`backend/app/main.py` + `backend/app/pipeline/`)
| Module | Responsibility |
|---|---|
| `backend/app/main.py` | All HTTP endpoints, the `burn_with_style` subtitle burner, the Pydantic models (`ExportSegment`, `StyleSettings`, `IntentRequest`), CORS + slowapi rate limiting, temp-dir cleanup, and the `/clips` static mount. |
| `backend/app/pipeline/extractor.py` | `extract_audio` — FFmpeg-extracts mono 16 kHz MP3 for transcription. |
| `backend/app/pipeline/analyzer.py` | `transcribe_audio` (Groq `whisper-large-v3-turbo`, word+segment timestamps) and `find_best_moments` (GPT-4o-mini picks N 30–45 s moments). |
| `backend/app/pipeline/editor.py` | `cut_and_merge` — FFmpeg-cuts each moment and concat-copies to a merged clip. |
| `backend/app/pipeline/reframe.py` | `reframe_to_vertical` — OpenCV Haar-cascade face detection averages the face X across sampled frames, then FFmpeg-crops to a centered 9:16. |
| `backend/app/pipeline/subtitles.py` | SRT/ASS generation, FFmpeg discovery (`_resolve_ffmpeg_bin` requires libass; `_any_ffmpeg_bin` for non-subtitle ops), and standalone burn helpers. |
| `backend/app/pipeline/storage.py` | boto3 S3 client for Cloudflare R2; `upload()` returns a 1-hour presigned URL. `enabled()` gates R2 vs. local `/clips`. |

### Render subprocess (`remotion-renderer/`)
`render.mjs` is a Node ESM script invoked by `/animate` via `subprocess.run`. It receives
the GPT-generated component as base64, bundles the Remotion project, drives headless
Chromium frame-by-frame, and encodes H.264 with FFmpeg. Renders are hardcoded to
720×1280 to fit the backend host's memory budget, then scaled up by the backend.

## HTTP API

All endpoints are on the backend (`backend/app/main.py`). Rate limits via slowapi, keyed by client IP.

| Method | Path | Limit | Purpose |
|---|---|---|---|
| GET | `/` | — | Health check (`{status: "running"}`). |
| GET | `/demo-video` | — | Serve `demo/demo.mp4`. |
| POST | `/demo-process` | 10/hr | Run the pipeline against the hosted demo video. |
| POST | `/parse-intent` | 20/min | GPT-4o-mini turns a chat message + editor context into a `steps[]` array. |
| POST | `/process` | 10/hr | Core pipeline. Modes: `single`, `multi` (3-worker pool), `transcribe`, `add_subtitles`. Multipart upload. |
| POST | `/crop` | 20/min | Aspect-ratio crop; `9/16` uses face-aware reframe. Multipart upload. |
| POST | `/add-subtitles` | 20/min | Transcribe an existing clip, return word timings + SRT. |
| POST | `/animate` | 10/hr | GPT-4o writes a Remotion component, renders it, returns a clip. |
| POST | `/export` | 10/hr | Concat timeline segments, apply crop, burn subtitles, return MP4 or R2 URL. |
| GET | `/download` | 20/min | SSRF-guarded proxy that fetches an R2 object and returns it as an attachment. |
| POST | `/cleanup` | 20/min | Wipe the `temp/` working tree. |
| — | `/clips/*` | — | Static mount serving `temp/clips_out/` when R2 is not configured. |

## Core data flow (`/process`, single mode)

1. Client uploads a video with a client-generated `job_id`; saved to `temp/{job_id}_input.mp4`.
2. `extract_audio` → `temp/audio.mp3` (mono 16 kHz).
3. `transcribe_audio` → Groq Whisper → object with `.segments` and `.words`.
4. `find_best_moments` → GPT-4o-mini → N 30–45 s moments (lengths enforced).
5. `cut_and_merge` → FFmpeg cuts each moment → `temp/clips_out/{job_id}_v.mp4`.
6. If subtitles requested, `generate_srt` builds 3-word chunks with timeline-rebased word
   timings → `{job_id}.srt` + `{job_id}_words.json`.
7. Each output is exposed via `_clip_url` → R2 presigned URL (if configured) or `/clips/{key}`.

## Key design notes & current constraints

- **Identifiers are client-controlled.** `job_id` / `srt_key` come from the request and are
  interpolated into filesystem paths and glob cleanup patterns. There is no per-user auth or
  ownership check — see [SECURITY.md](SECURITY.md).
- **No job queue / polling.** Every pipeline step is a single awaited fetch, so long
  FFmpeg/Whisper/Remotion operations block within one HTTP request and can time out.
- **Shared `Generated.tsx`.** `/animate` writes one shared `remotion-renderer/src/Generated.tsx`
  per request; concurrent animate calls race on this file.
- **Preview/export parity.** The canvas preview and the libass burn are separate
  implementations; expect minor layout differences.
- **R2 presigned URLs expire in 1 hour.** Exported clips referenced by those URLs are not
  durable beyond that window.
