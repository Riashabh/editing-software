# Wordcut frontend

The Next.js 16 / React 19 client for [Wordcut](../README.md) — the chat-driven video editor UI.
It turns a user's plain-English message into a pipeline of backend calls and previews the result
(with live canvas subtitles) before export.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

It talks to the backend at `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`). Start the
backend too — see the [root README](../README.md#quick-start).

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL the browser calls. Set this in Vercel for production. |

## Layout

```
app/
  page.tsx              The whole app today: chat, editor, dual-track timeline, export
  layout.tsx            Root layout, fonts, Vercel Analytics
  components/
    VideoPlayer.tsx     <video> + <canvas> overlay that renders subtitles live
    StylePanel.tsx      Subtitle style editor; exports Subtitle/SubStyle/DEFAULT_STYLE
    icons.tsx           Icon set
  how-it-works/page.tsx Marketing / explainer page
```

## Notes

- **Read `AGENTS.md` before changing build config.** This Next.js version has breaking changes
  vs. older releases; the authoritative docs are vendored under `node_modules/next/dist/docs/`.
- `page.tsx` is a ~1440-line monolith. Prefer extracting components out of it over adding more.
- The canvas subtitle preview is a *separate* implementation from the backend's libass burn, so
  the preview can differ slightly from the exported MP4.

See [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for how the frontend drives the backend
pipeline.
