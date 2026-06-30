# Troubleshooting

Common failures and their fixes, ordered roughly by how often they bite.

## FFmpeg / libass

**Symptom:** `/export` returns 500, backend logs show:
```
RuntimeError: No FFmpeg build with `ass` or `subtitles` was found (needs libass).
```

**Cause:** burning subtitles needs an FFmpeg built with **libass** (the `ass`/`subtitles`
filters). Two macOS traps:
- The Apple Command Line Tools FFmpeg in `/usr/bin` often has **no** libass.
- Homebrew FFmpeg 8.x is **sometimes built without** libass.

**Verify your FFmpeg has it:**
```bash
ffmpeg -filters | grep -E '(^| )ass|subtitles'
# or
ffmpeg -h filter=ass        # should print filter help, not "Unknown filter"
```

**Fix on macOS:**
```bash
brew reinstall ffmpeg
# if still missing, the homebrew-ffmpeg tap has a libass-enabled build:
brew tap homebrew-ffmpeg/ffmpeg
brew install homebrew-ffmpeg/ffmpeg/ffmpeg
```
Then **restart `uvicorn` from a fresh shell** so it picks up the new binary on PATH — a server
started before the reinstall keeps the old FFmpeg.

**Point the app at a specific build** without changing PATH:
```bash
export FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
```
(`FFMPEG_PATH`, then `FFMPEG`, are checked before PATH discovery — see [subtitles.py](../backend/app/pipeline/subtitles.py).)

> On Debian/Docker (production) the apt `ffmpeg` package includes libass, so this is a
> macOS-only problem.

---

## CORS errors in the browser

**Symptom:** `Access to fetch ... has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header`.

**Cause:** the frontend origin isn't in the backend's allow-list. The backend only allows
`wordcut.app`, `www.wordcut.app`, `wordcutai.vercel.app`, and `localhost` (any port).

**Fix:** add your origin to `ALLOWED_ORIGINS` in [backend/app/main.py](../backend/app/main.py) and restart the backend.
If you're running the frontend on a non-localhost host (e.g. a LAN IP or a tunnel), add that
exact origin.

---

## Export 500 even without subtitles

**Symptom:** export crashes with the libass error above even though you didn't ask for
subtitles.

**Cause (known issue):** `/export` resolves a libass-capable FFmpeg up front, before the
no-subtitle path can return — so a machine without libass fails even for a plain
concat/crop/copy export. Tracked in [SECURITY.md](SECURITY.md) / the backlog.

**Workaround:** install a libass-enabled FFmpeg (above). The proper fix is to use
`_any_ffmpeg_bin()` for non-subtitle operations and only require libass when actually burning.

---

## Animation render fails

**Symptom:** `/animate` returns an error; logs show `RENDER_ERROR:` or a Chromium/browser
launch failure.

**Causes & fixes:**
- **Chromium not found** (in Docker): set `CHROMIUM_PATH=/usr/bin/chromium`. The Dockerfile
  installs Chromium but doesn't export this var.
- **Out of memory:** renders are tuned to 720×1280 for a constrained host. A larger video or
  host change can blow the budget — lower resolution or raise host memory.
- **Concurrent animate requests:** all `/animate` calls write the same
  `remotion-renderer/src/Generated.tsx`, so simultaneous requests can render the wrong
  component. Serialize animate calls or give each its own file (tracked in the backlog).
- **120 s timeout:** the render subprocess is killed after 120 s.

---

## Transcription fails

**Symptom:** `/process` 500s during the transcribe step.

**Cause:** missing or invalid `GROQ_API_KEY` (transcription is **Groq** Whisper, not OpenAI),
or the model returned malformed JSON for moment-finding (a single `json.loads` with no retry).

**Fix:** confirm `GROQ_API_KEY` and `OPENAI_API_KEY` are both set ([ENVIRONMENT.md](ENVIRONMENT.md)).

---

## Demo video not available

**Symptom:** `/demo-process` fails with a fetch error.

**Cause:** `DEMO_VIDEO_URL` is unreachable, or R2 isn't configured the way the default URL
expects.

**Fix:** set `DEMO_VIDEO_URL` to a reachable MP4, or upload your own demo (see
[upload_demo.py](../upload_demo.py)).

---

## R2 upload crashes

**Symptom:** `KeyError: 'R2_ACCESS_KEY_ID'` (or another R2 var) during export/upload.

**Cause:** `R2_ENDPOINT_URL` is set (so the app thinks R2 is enabled) but one of the other
three R2 vars is missing.

**Fix:** set **all four** R2 variables, or unset `R2_ENDPOINT_URL` to fall back to local
storage. See the R2 note in [ENVIRONMENT.md](ENVIRONMENT.md).
