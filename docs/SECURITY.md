# Security

> **Status: the API is currently unauthenticated and has several unhardened, client-controlled
> inputs.** It is fine for local/demo use behind a trusted network. **Do not expose it to the
> open internet** until at least the Critical and High items below are addressed.

This is a living backlog from a structural audit of the codebase. Each item lists the location,
the concrete risk, and the recommended fix. Items are behavior/logic changes and are **not yet
applied** — they're tracked here for prioritization.

## Critical

### C1 — SSRF via `source_url` in `/export`
- **Where:** [backend/app/main.py:738](../backend/app/main.py#L738) (`urllib.request.urlretrieve(s.source_url, local)`)
- **Risk:** `ExportSegment.source_url` comes straight from the request body and is only checked
  with `.startswith("http")`. An unauthenticated caller can set it to
  `http://169.254.169.254/latest/meta-data/...` (cloud metadata / IAM creds) or any internal
  host, and the server fetches it and writes it to disk.
- **Fix:** restrict to an explicit allow-list (your R2 host), resolve the hostname and reject
  private/link-local/loopback IP ranges, require `https`, and disable or re-validate redirects.
  Don't derive local paths from the URL filename.

### C2 — Path traversal via `job_id` / `srt_key`
- **Where:** [backend/app/main.py:463](../backend/app/main.py#L463) and nearly every endpoint; cleanup glob at
  [backend/app/main.py:826](../backend/app/main.py#L826).
- **Risk:** these unvalidated query strings are interpolated directly into filesystem paths.
  `job_id=../../tmp/evil` writes outside `temp/`; a crafted `key` in the `/export` cleanup glob
  (`glob.glob(f"temp/{key}*")` → `os.remove`) enables **arbitrary file deletion**.
- **Fix:** validate against a strict regex (e.g. `^[a-z0-9_]{1,40}$`); reject anything with `/`,
  `..`, or `os.sep`; and verify `os.path.abspath(path)` stays within the intended base dir
  (`os.path.commonpath`) before any `open`/`remove`.

## High

### H1 — No authentication on any endpoint
- **Where:** [backend/app/main.py](../backend/app/main.py) (no `Depends`/security scheme anywhere).
- **Risk:** every endpoint is open to the internet, gated only by per-IP rate limits. This
  amplifies every other finding to pre-auth remote exploitability, lets anyone burn your
  OpenAI/Groq/render compute, and lets anyone who guesses a `job_id` read/modify/delete another
  user's clips.
- **Fix:** require an API key or session on all mutating/processing endpoints; scope `job_id`/
  `srt_key` to the authenticated principal and check ownership before serving or deleting files.

### H2 — GPT-generated code is executed in `/animate`
- **Where:** [backend/app/main.py:623](../backend/app/main.py#L623) → `remotion-renderer/src/Generated.tsx` → `node render.mjs`.
- **Risk:** an attacker-controlled prompt influences the TSX that gets bundled and run in
  headless Chromium. The system prompt's "import only from remotion" rule is a *suggestion to the
  model*, not enforced.
- **Fix:** treat generated code as untrusted — render it in an isolated, network-less, read-only
  sandbox with dropped privileges; AST-validate the module to allow only whitelisted imports;
  never write it into the persistent project tree.

### H3 — `/download` redirect SSRF bypass
- **Where:** [backend/app/main.py:703](../backend/app/main.py#L703).
- **Risk:** the host check passes, then `urlopen` **follows redirects** to a target that is never
  re-validated — an allowed-host URL that 302s to an internal address is fetched server-side.
- **Fix:** disable redirect following (custom opener), re-validate the final host/IP (block
  private ranges), and scope to the specific bucket/key prefix this app owns.

### H4 — FFmpeg concat-file injection in `/export`
- **Where:** [backend/app/main.py:748](../backend/app/main.py#L748) (writes `file '{seg_path(seg)}'` into a `-f concat -safe 0` manifest).
- **Risk:** `seg_path` is derived from `source_url`. A path containing a single quote breaks out
  of the quoting; with `-safe 0` the concat demuxer accepts absolute paths and directives.
- **Fix:** resolve each segment to a validated path inside `temp/clips_out` (reject `..`/absolute
  escapes), escape paths safely, or pass inputs as separate `-i` args with a `filter_complex`
  concat instead of a text manifest.

### H5 — `/export` cleanup wipes all jobs when `key` is empty
- **Where:** [backend/app/main.py:826](../backend/app/main.py#L826).
- **Risk:** `key = srt_key or job_id`, both optional and defaulting to `""`. A segment-only NLE
  export with neither set makes the glob `temp/*` / `temp/clips_out/*` and `os.remove`s **every
  other job's files**.
- **Fix:** refuse cleanup when `key` is empty (return 400 if both are blank); match on a
  `{key}_` / `{key}.` boundary or use a per-job subdirectory instead of a bare prefix glob.

## Medium / Low

- **Internal error details leaked to clients** — `detail=str(e)` ([backend/app/main.py:539](../backend/app/main.py#L539))
  exposes stack/internal info. Return a generic message; log the detail server-side.
- **`localhost` CORS regex is always active**, including in production. Gate it behind a
  dev-only flag.
- **No upload size/content-type limits** on `/process`, `/crop`, `/demo-process` before invoking
  FFmpeg/external APIs — resource-exhaustion vector.
- **Bare `except: pass`** in temp cleanup ([backend/app/main.py:69](../backend/app/main.py#L69), [backend/app/main.py:829](../backend/app/main.py#L829))
  swallows real errors. Catch narrowly and log.

## Suggested order of work

1. **C2** (path traversal) and **H5** (cleanup wipe) — small, contained, high impact.
2. **H1** (auth) — unblocks scoping everything else to a user.
3. **C1 / H3 / H4** (SSRF + injection) — once inputs are owned by a user, lock down the fetch/
   concat paths.
4. **H2** (`/animate` sandbox) — larger infra change; isolate the renderer.
