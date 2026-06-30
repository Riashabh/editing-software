# Contributing to Wordcut

Thanks for working on Wordcut. This guide covers local setup, how the repo is laid out, and the
conventions to follow.

## Local setup

See the [README quick start](README.md#quick-start) for the full three-process setup (backend,
Remotion renderer, frontend). In short:

```bash
# Backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # fill in OPENAI_API_KEY + GROQ_API_KEY
uvicorn backend.app.main:app --reload

# Renderer (one-time)
cd remotion-renderer && npm install --legacy-peer-deps

# Frontend
cd frontend && npm install && npm run dev
```

> ⚠️ Subtitle export needs an **FFmpeg built with libass**. If `/export` 500s on macOS, see
> [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md#ffmpeg--libass).

> The Docker image uses Python 3.11; local development has been on 3.9. Stick to syntax that
> works on **3.9+** in backend code.

## Repository layout

```
backend/app/main.py        FastAPI app — all endpoints, the subtitle burner, the Pydantic models
backend/app/pipeline/      Pipeline modules: extractor, analyzer, editor, reframe, subtitles, storage
frontend/                  Next.js app (app/page.tsx is the whole UI today)
remotion-renderer/         Node script that turns GPT-generated React into MP4
scripts/                   cli.py (standalone pipeline CLI, not used by the server) + upload_demo.py
tests/                     pytest suite — see conftest.py for the mocking strategy
docs/                      Architecture, environment, deployment, troubleshooting, security
hyperframes-poc/           Separate experimental POC — not part of the deployed product
```

Run the backend as `uvicorn backend.app.main:app --reload` from the repo root. The standalone
pipeline CLI is `python scripts/cli.py <video.mp4>`.

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand how a request flows
through the system.

## Conventions

### Backend (Python)
- Endpoints live in `backend/app/main.py`; reusable pipeline logic lives in `backend/app/pipeline/`.
- User-controlled values (`job_id`, `srt_key`, URLs) must be validated before they touch the
  filesystem or a subprocess — see the open items in [docs/SECURITY.md](docs/SECURITY.md).
- Wrap `subprocess.run`/`ffprobe` calls so a tool failure returns a clean `HTTPException`, not an
  unhandled 500.
- Resolve FFmpeg via the helpers in `backend/app/pipeline/subtitles.py`: `_resolve_ffmpeg_bin()` **only** when
  you need libass (subtitle burning); `_any_ffmpeg_bin()` for plain cut/crop/concat/copy.

### Tests
- Run the suite with `pip install -r requirements-dev.txt && pytest` from the repo root.
- The suite mocks every external/paid service (OpenAI, Groq, R2, the Node/Remotion renderer)
  and runs real FFmpeg on a tiny generated clip — see [tests/conftest.py](tests/conftest.py).
  The mocks are patched onto the app module (`api.transcribe_audio`, `api.client`,
  `api.storage.enabled`, etc.), so new endpoints that call new externals need a matching mock.
- Subtitle-burning tests are marked `needs_libass` and skip when libass is unavailable.
- Add a test for every new endpoint or behavior change; keep the suite green before pushing.

### Frontend (TypeScript / Next.js)
- `frontend/AGENTS.md` warns that this Next.js version has breaking changes vs. older releases —
  read the in-repo docs under `node_modules/next/dist/docs/` before changing build/config.
- New work should prefer extracting components out of the `page.tsx` monolith rather than growing
  it further.
- Read live state inside long-lived event handlers via refs, not closures, to avoid stale-state
  bugs (see the pattern around `activeVideoSegIdRef` in `page.tsx`).

### Git hygiene
- Never commit `node_modules/`, build output, `.env`, media files (`*.mp4`/`*.mp3`), or
  `.DS_Store`. These are covered by [.gitignore](.gitignore) — if something slipped in, untrack it
  with `git rm --cached`.
- `.env.example` **is** committed (it's a template); the real `.env` is not.

## Before opening a PR

- [ ] Tests pass: `pytest` (and you added tests for any new behavior).
- [ ] Backend starts cleanly: `uvicorn backend.app.main:app --reload`.
- [ ] Frontend builds: `cd frontend && npm run build`.
- [ ] You ran the relevant pipeline path end-to-end (upload → process → export).
- [ ] No secrets, media, or `node_modules` in the diff.
- [ ] If you changed behavior touching a [SECURITY.md](docs/SECURITY.md) item, note it in the PR.
