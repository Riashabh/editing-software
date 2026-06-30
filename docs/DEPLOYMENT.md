# Deployment

Wordcut deploys as two independent pieces:

- **Backend** — a single Docker image (FastAPI + FFmpeg + Node + Chromium), run on Railway.
- **Frontend** — a Next.js app deployed on Vercel.

They communicate over HTTPS; the frontend's `NEXT_PUBLIC_API_URL` points at the backend.

---

## Backend (Docker → Railway)

The [Dockerfile](../Dockerfile) builds one image from `python:3.11-slim` that bundles
everything the pipeline needs:

- `ffmpeg` (with libass on Debian — no macOS gotcha here), `chromium` + its headless X/GTK
  libraries, `curl`/`ca-certificates`.
- Node.js 20 (NodeSource) for the Remotion renderer.
- Python deps from `requirements.txt`, then `npm install --legacy-peer-deps` inside
  `remotion-renderer/`.

### Build & run locally
```bash
docker build -t wordcut-backend .
docker run -p 8000:8000 --env-file .env wordcut-backend
```

The container's start command is:
```
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*'
```

### Railway notes
- Set every backend variable from [ENVIRONMENT.md](ENVIRONMENT.md) in the Railway service.
- **Memory:** Remotion renders are hardcoded to 720×1280 ([backend/app/main.py](../backend/app/main.py), `/animate`)
  specifically to fit Railway's memory budget, then scaled up by a second FFmpeg pass. If you
  move to a larger host you can raise this.
- **Chromium:** the Dockerfile installs `chromium` but does **not** set `CHROMIUM_PATH`. If
  Remotion can't auto-locate the apt Chromium in your environment, set `CHROMIUM_PATH` to the
  installed binary (typically `/usr/bin/chromium`). See [TROUBLESHOOTING.md](TROUBLESHOOTING.md#animation-render-fails).

---

## Frontend (Vercel)

```bash
cd frontend
npm install
npm run build      # production build
npm run start      # or let Vercel run it
```

- Set `NEXT_PUBLIC_API_URL` in the Vercel project to the backend's public URL.
- The backend's CORS allow-list ([backend/app/main.py](../backend/app/main.py)) must include the frontend origin. It
  currently allows `wordcut.app`, `www.wordcut.app`, `wordcutai.vercel.app`, and any
  `localhost` port. Add new production origins there.
- `frontend/next.config.ts` is currently empty (Vercel defaults). `frontend/AGENTS.md` notes
  this Next.js version has breaking changes vs. older releases — read the in-repo Next docs
  under `node_modules/next/dist/docs/` before changing build config.

---

## CORS & origins

When you add a new frontend domain, update the `ALLOWED_ORIGINS` list in [backend/app/main.py](../backend/app/main.py).
The `localhost` regex is always active (including in production) for dev convenience — see
[SECURITY.md](SECURITY.md) for the tradeoff.

---

## Storage

- With R2 configured, exported/animated clips are uploaded and served via **1-hour presigned
  URLs**. These are not durable links — don't treat them as permanent.
- Without R2, clips are served from the container's local `/clips` mount and disappear when the
  container restarts.

---

## Pre-deploy checklist

- [ ] All required env vars set on both services ([ENVIRONMENT.md](ENVIRONMENT.md)).
- [ ] Frontend origin added to backend CORS allow-list.
- [ ] `NEXT_PUBLIC_API_URL` points at the deployed backend.
- [ ] R2 credentials are complete (all four vars) or intentionally absent.
- [ ] Reviewed [SECURITY.md](SECURITY.md) — the API is currently unauthenticated.
