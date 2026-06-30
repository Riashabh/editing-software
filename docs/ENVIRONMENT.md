# Environment variables

Every variable read by the code, where it's used, and whether it's required. The backend
loads `.env` via `python-dotenv` (`load_dotenv()` in [backend/app/main.py](../backend/app/main.py)). Copy
[`.env.example`](../.env.example) to `.env` and fill in the required keys.

## Backend

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | **Yes** | [backend/app/main.py:21](../backend/app/main.py#L21), [analyzer.py:9](../backend/app/pipeline/analyzer.py#L9) | GPT-4o-mini (intent parsing, best-moment finding) and GPT-4o (animation codegen). |
| `GROQ_API_KEY` | **Yes** | [analyzer.py:10](../backend/app/pipeline/analyzer.py#L10) | Groq Whisper (`whisper-large-v3-turbo`) transcription. **Without this, all transcription fails.** |
| `R2_ENDPOINT_URL` | No¹ | [storage.py:12](../backend/app/pipeline/storage.py#L12) | Cloudflare R2 S3 endpoint. Its presence is what toggles R2 vs. local storage (`storage.enabled()`). |
| `R2_ACCESS_KEY_ID` | No¹ | [storage.py:13](../backend/app/pipeline/storage.py#L13) | R2 access key. |
| `R2_SECRET_ACCESS_KEY` | No¹ | [storage.py:14](../backend/app/pipeline/storage.py#L14) | R2 secret key. |
| `R2_BUCKET` | No¹ | [storage.py:21](../backend/app/pipeline/storage.py#L21) | R2 bucket name for uploads. |
| `DEMO_VIDEO_URL` | No | [backend/app/main.py:96](../backend/app/main.py#L96) | Source video for `/demo-process`. Defaults to a hosted demo on `pub-*.r2.dev`. |
| `FFMPEG_PATH` | No | [subtitles.py:203](../backend/app/pipeline/subtitles.py#L203) | Absolute path to a specific FFmpeg binary, checked before PATH discovery. |
| `FFMPEG` | No | [subtitles.py:203](../backend/app/pipeline/subtitles.py#L203) | Fallback override if `FFMPEG_PATH` is unset. |
| `CHROMIUM_PATH` | No | [render.mjs:65](../remotion-renderer/render.mjs#L65) | Path to the Chromium binary for Remotion. If unset, Remotion locates/downloads its own. |

¹ **R2 is all-or-nothing.** `storage.enabled()` only checks `R2_ENDPOINT_URL`, but
`storage._client()` reads `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` with
`os.environ[...]` (raises `KeyError` if missing). So either set **all four** R2 variables or
**none** — setting only `R2_ENDPOINT_URL` will crash uploads. With none set, clips are served
locally from `/clips`.

## Frontend

| Variable | Required | Used by | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | [page.tsx:8](../frontend/app/page.tsx#L8) | Backend base URL the browser calls. Defaults to `http://localhost:8000`. Must be set in the Vercel project for production. |

## Minimal local `.env`

```bash
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
# R2 omitted → clips served locally from /clips
```

## Production `.env` (with R2)

```bash
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
R2_ENDPOINT_URL=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=wordcut
DEMO_VIDEO_URL=https://<your-public-r2>/demo/demo.mp4
```
