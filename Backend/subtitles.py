import os
import re
import shutil
import subprocess
import sys
from typing import List, Optional, Set, Tuple


# Fallback if whitespace-based parse misses a line (unusual locales / FFmpeg variants).
_FILTER_LIST_LINE = re.compile(r"^\s+[A-Za-z.]+\s+(\S+)\s+\S+->\S+")


def generate_srt(transcript, moments, output_path="temp/subtitles.srt"):
    def format_time(seconds):
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    subtitles = []
    time_offset = 0

    for moment in moments:
        m_start = moment["start"]
        m_end = moment["end"]

        words = [w for w in transcript.words if w.start >= m_start and w.end <= m_end]

        chunk_size = 3
        for i in range(0, len(words), chunk_size):
            chunk = words[i:i + chunk_size]
            start = chunk[0].start - m_start + time_offset
            end = chunk[-1].end - m_start + time_offset
            text = " ".join(w.word.strip() for w in chunk)
            subtitles.append((start, end, text))

        time_offset += m_end - m_start

    with open(output_path, "w", encoding="utf-8") as f:
        for i, (start, end, text) in enumerate(subtitles):
            f.write(f"{i+1}\n")
            f.write(f"{format_time(start)} --> {format_time(end)}\n")
            f.write(f"{text}\n\n")

    print(f"SRT file saved to {output_path}")
    return output_path


def _srt_timestamp_to_ass(srt_ts: str) -> str:
    """SRT 00:00:01,234 -> ASS 0:00:01.23 (centiseconds)."""
    srt_ts = srt_ts.strip()
    m = re.match(
        r"(\d{2}):(\d{2}):(\d{2})[,.](\d{3})",
        srt_ts,
    )
    if not m:
        raise ValueError(f"Bad SRT timestamp: {srt_ts!r}")
    h, mi, s, ms = map(int, m.groups())
    centis = min(99, (ms + 5) // 10)  # round ms to centiseconds
    # Drop leading zero on hours for typical ASS style (0:00:00.00)
    return f"{h:d}:{mi:02d}:{s:02d}.{centis:02d}"


def _escape_ass_dialogue_text(text: str) -> str:
    """Escape user text for ASS Dialogue lines."""
    text = text.strip().replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\\", r"\\")
    text = text.replace("{", r"\{").replace("}", r"\}")
    text = text.replace("\n", r"\N")
    return text


def convert_srt_to_ass(srt_path: str, ass_path: Optional[str] = None) -> str:
    """
    Convert SRT to ASS so FFmpeg can burn with the `ass` filter (reliable on FFmpeg 8 / macOS).
    """
    srt_path = os.path.abspath(srt_path)
    if ass_path is None:
        base, _ = os.path.splitext(srt_path)
        ass_path = base + ".ass"
    else:
        ass_path = os.path.abspath(ass_path)

    os.makedirs(os.path.dirname(ass_path) or ".", exist_ok=True)

    raw = open(srt_path, encoding="utf-8", errors="replace").read()
    blocks = re.split(r"\n\s*\n", raw.strip())
    dialogues: list[tuple[str, str, str]] = []

    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip() != ""]
        if len(lines) < 2:
            continue
        # Optional index line (digits only)
        idx = 0
        if re.fullmatch(r"\d+", lines[0].strip()):
            idx = 1
        if idx >= len(lines):
            continue
        timing_line = lines[idx]
        tm = re.match(
            r"(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})",
            timing_line,
        )
        if not tm:
            continue
        start_ass = _srt_timestamp_to_ass(tm.group(1))
        end_ass = _srt_timestamp_to_ass(tm.group(2))
        body = "\n".join(lines[idx + 1 :])
        body = _escape_ass_dialogue_text(body)
        if not body:
            continue
        dialogues.append((start_ass, end_ass, body))

    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,32,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,2,2,20,20,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header)
        for start_ass, end_ass, body in dialogues:
            f.write(
                f"Dialogue: 0,{start_ass},{end_ass},Default,,0,0,0,,{body}\n"
            )

    print(f"ASS file written to {ass_path}")
    return ass_path


def _ffmpeg_filter_names(ffmpeg_bin: str) -> Set[str]:
    """Return filter names reported by `ffmpeg -filters` (empty if probe fails)."""
    try:
        r = subprocess.run(
            [ffmpeg_bin, "-hide_banner", "-filters"],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return set()
    text = (r.stdout or "") + "\n" + (r.stderr or "")
    names: Set[str] = set()
    for line in text.splitlines():
        # FFmpeg 7/8: " .. abench            A->A       ..." — name is 2nd token, pad types 3rd.
        parts = line.split()
        if len(parts) >= 3 and "->" in parts[2]:
            names.add(parts[1])
        else:
            m = _FILTER_LIST_LINE.match(line)
            if m:
                names.add(m.group(1))
    return names


def _ffmpeg_filter_help_exists(ffmpeg_bin: str, filter_name: str) -> bool:
    """
    Reliable check for a lavfi filter (works when -filters layout changes).
    When libass is missing, `ass` / `subtitles` are absent entirely.
    """
    try:
        r = subprocess.run(
            [ffmpeg_bin, "-hide_banner", "-h", f"filter={filter_name}"],
            capture_output=True,
            text=True,
            timeout=30,
        )
    except OSError:
        return False
    text = (r.stdout or "") + (r.stderr or "")
    if "Unknown filter" in text or "No match for filter" in text:
        return False
    # Help for an existing filter is usually long and repeats the name.
    return r.returncode == 0 and len(text.strip()) > 80 and filter_name in text


def _ffmpeg_candidate_bins() -> List[str]:
    """
    Order matters: on macOS, try Homebrew ffmpeg before `which ffmpeg` so we don't
    pick Apple's stub in /usr/bin when both exist.
    """
    candidates: List[str] = []
    for key in ("FFMPEG_PATH", "FFMPEG"):
        v = os.environ.get(key)
        if v:
            candidates.append(os.path.expanduser(v.strip()))
    if sys.platform == "darwin":
        for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
            p = os.path.expanduser(p)
            if os.path.isfile(p) and os.access(p, os.X_OK):
                candidates.append(p)
    w = shutil.which("ffmpeg")
    if w:
        candidates.append(w)

    seen: set[str] = set()
    ordered: List[str] = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered


def _resolve_ffmpeg_bin() -> Tuple[str, Set[str]]:
    """
    Pick an ffmpeg that has libass-based subtitle burning.

    Apple's Command Line Tools `ffmpeg` often has **no** `ass` / `subtitles` filters.
    Homebrew's ffmpeg usually has both.
    """
    ordered = _ffmpeg_candidate_bins()
    if not ordered:
        raise RuntimeError(
            "No `ffmpeg` found on PATH.\n"
            "Install: brew install ffmpeg\n"
            "Or set FFMPEG_PATH in .env to the full path to ffmpeg."
        )

    tried_notes: List[str] = []
    for bin_path in ordered:
        has_ass = _ffmpeg_filter_help_exists(bin_path, "ass")
        has_sub = _ffmpeg_filter_help_exists(bin_path, "subtitles")
        names = _ffmpeg_filter_names(bin_path)
        if has_ass or has_sub:
            filt: Set[str] = set()
            if has_ass:
                filt.add("ass")
            if has_sub:
                filt.add("subtitles")
            return bin_path, filt
        if names:
            tried_notes.append(
                f"  - {bin_path}: no `ass`/`subtitles` filters (libass not in this build; "
                f"{len(names)} filters listed)"
            )
        else:
            tried_notes.append(f"  - {bin_path}: could not list filters (missing binary?)")

    raise RuntimeError(
        "No FFmpeg build with `ass` or `subtitles` was found (needs **libass**).\n"
        "Homebrew ffmpeg 8.x is sometimes built **without** libass — burning subs then fails.\n\n"
        "Checked:\n"
        + "\n".join(tried_notes)
        + "\n\n"
        "To enable burned-in subtitles, reinstall ffmpeg with libass, e.g.:\n"
        "  brew reinstall ffmpeg\n"
        "  # If still missing: brew install libass && brew reinstall ffmpeg\n\n"
        "Or use another ffmpeg binary that lists `ass` in:\n"
        "  ffmpeg -h filter=ass\n\n"
        "Alternatively, call burn_subtitles(..., burn_in=False) to mux soft subs (no libass)."
    )


def _any_ffmpeg_bin() -> str:
    """First usable ffmpeg binary (for mux/copy; does not need libass)."""
    ordered = _ffmpeg_candidate_bins()
    if not ordered:
        raise RuntimeError(
            "No `ffmpeg` found on PATH. Install: brew install ffmpeg"
        )
    return ordered[0]


def _mux_soft_subtitles(
    video_path: str,
    srt_path: str,
    output_path: str,
    ffmpeg_bin: str,
) -> None:
    """
    Embed SRT as an MP4 timed-text track (mov_text). No libass / no burning.
    Subtitles can be toggled in QuickTime / VLC; they are not baked into pixels.
    """
    cmd = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        video_path,
        "-i",
        srt_path,
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-map",
        "1:0",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-c:s",
        "mov_text",
        "-metadata:s:s:0",
        "language=eng",
        output_path,
    ]
    subprocess.run(cmd, check=True)


def _vf_for_burn(ass_path: str, filters: Set[str]) -> str:
    """Build -vf string: prefer ass, else subtitles (both need filename= on FFmpeg 7+)."""
    path_arg = _ffmpeg_filter_path_value(ass_path)
    if "ass" in filters:
        return f"ass=filename={path_arg}"
    if "subtitles" in filters:
        return f"subtitles=filename={path_arg}"
    raise RuntimeError(
        "This FFmpeg build has no `ass` or `subtitles` filter (needs libass). "
        "Apple Command Line Tools ffmpeg is often missing them.\n\n"
        "Fix: install a full FFmpeg and put it first on PATH, e.g.\n"
        "  brew install ffmpeg\n"
        "Or set FFMPEG_PATH to your Homebrew binary, e.g.\n"
        "  export FFMPEG_PATH=/opt/homebrew/bin/ffmpeg"
    )


def _ffmpeg_filter_path_value(path: str) -> str:
    """
    Format a filesystem path as the value of ass=filename=... for -vf.

    FFmpeg 7/8: **ass=/absolute/path** fails with "No option name near '/...'" because
    the '/' right after '=' is not parsed as part of a filename — use **filename=** instead.

    Wrap in single quotes when the path has spaces or other special characters.
    See: https://ffmpeg.org/ffmpeg-filters.html#Quoting-and-escaping
    """
    path = os.path.abspath(path).replace("\\", "/")
    # Safe unquoted: typical macOS / Unix paths (no spaces, quotes, commas, colons).
    if re.fullmatch(r"[A-Za-z0-9/_.\-]+", path):
        return path
    escaped = path.replace("\\", r"\\").replace("'", r"\'")
    return f"'{escaped}'"


def burn_subtitles(
    video_path,
    srt_path,
    output_path="output_subtitled.mp4",
    burn_in: Optional[bool] = None,
):
    """
    Subtitles on the output video.

    - **burn_in=None** (default): try pixel burn-in (needs FFmpeg **libass**); if this
      FFmpeg has no `ass`/`subtitles` filters (common with Homebrew ffmpeg 8.x without
      libass), **fall back** to embedding the SRT as a **soft** `mov_text` track.
    - **burn_in=True**: require burn-in only; raise if libass is missing.
    - **burn_in=False**: only embed soft subs (no re-encode of video).

    Env **FFMPEG_PATH** / **FFMPEG** and `.env` are respected (via load_dotenv).
    """
    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass

    video_path = os.path.abspath(video_path)
    srt_path = os.path.abspath(srt_path)
    output_path = os.path.abspath(output_path)
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # Soft subs only — no ASS file needed
    if burn_in is False:
        fb = _any_ffmpeg_bin()
        print(f"Embedding soft subtitles (mov_text) with: {fb}")
        _mux_soft_subtitles(video_path, srt_path, output_path, fb)
        print(f"Soft subtitles written to {output_path}")
        return output_path

    if burn_in is True:
        ffmpeg_bin, filters = _resolve_ffmpeg_bin()
    else:
        try:
            ffmpeg_bin, filters = _resolve_ffmpeg_bin()
        except RuntimeError:
            fb = _any_ffmpeg_bin()
            print(
                "WARNING: This FFmpeg has no libass (`ass`/`subtitles` filters). "
                "Cannot burn subtitles into pixels. Embedding SRT as a soft subtitle track instead "
                "(toggle in QuickTime/VLC). Reinstall ffmpeg with libass for true burn-in."
            )
            _mux_soft_subtitles(video_path, srt_path, output_path, fb)
            print(f"Soft subtitles written to {output_path}")
            return output_path

    ass_path = convert_srt_to_ass(srt_path)
    vf = _vf_for_burn(ass_path, filters)
    print(f"Burning subtitles with: {ffmpeg_bin} ({vf.split('=')[0]} filter)")

    command = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        video_path,
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "18",
        "-c:a",
        "copy",
        output_path,
    ]
    subprocess.run(command, check=True)
    print(f"Subtitles burned to {output_path}")
    return output_path
