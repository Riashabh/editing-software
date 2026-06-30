"""Shared pytest fixtures for the Wordcut backend.

Strategy (see docs/ARCHITECTURE.md): the paid/external services — OpenAI, Groq
(transcription), Cloudflare R2, and the Remotion/Node renderer — are mocked so the
suite is fast, free, deterministic, and needs no API keys. FFmpeg/ffprobe run for
real against tiny generated clips, so the actual cut/crop/concat/burn code paths are
exercised.

The app module is imported via a fallback so the SAME tests work before and after the
`backend/app` restructure.
"""
import json
import os
import shutil
import subprocess
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

# Make the repo root importable regardless of where pytest is invoked from.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# The app constructs OpenAI/Groq clients at import time, which require non-empty keys.
# Tests mock those clients, so dummy keys are sufficient — and this keeps the suite
# runnable without real credentials (e.g. in CI). setdefault preserves real keys if set.
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("GROQ_API_KEY", "test-key")

# The FastAPI app module. Tests reference it as `api`.
import backend.app.main as api

from fastapi.testclient import TestClient


# ── capability probes (let CI skip libass-dependent tests gracefully) ──────────
def _has_ffmpeg() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _has_libass() -> bool:
    from backend.app.pipeline.subtitles import _resolve_ffmpeg_bin
    try:
        _resolve_ffmpeg_bin()
        return True
    except Exception:
        return False


HAS_FFMPEG = _has_ffmpeg()
HAS_LIBASS = _has_libass()

requires_ffmpeg = pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg/ffprobe not on PATH")
requires_libass = pytest.mark.skipif(not HAS_LIBASS, reason="ffmpeg build lacks libass")


# ── fake transcription data (matches the real .segments / .words contract) ─────
def make_transcript():
    """A transcript object shaped like Groq Whisper's verbose_json result.

    `.segments` items are dicts with start/end/text; `.words` items are dicts with
    word/start/end. Both are what analyzer/subtitles read.
    """
    words = [
        {"word": "hello", "start": 0.0, "end": 0.4},
        {"word": "world", "start": 0.4, "end": 0.8},
        {"word": "this", "start": 0.8, "end": 1.2},
        {"word": "is", "start": 1.2, "end": 1.5},
        {"word": "a", "start": 1.5, "end": 1.7},
        {"word": "test", "start": 1.7, "end": 2.0},
    ]
    segments = [{"start": 0.0, "end": 2.0, "text": "hello world this is a test"}]
    return SimpleNamespace(segments=segments, words=words)


FAKE_MOMENTS = [{"start": 0.0, "end": 2.0, "reason": "test moment"}]


@pytest.fixture
def api_module():
    """The imported FastAPI app module (named `api` regardless of layout)."""
    return api


@pytest.fixture
def client():
    return TestClient(api.app)


@pytest.fixture
def sample_video(tmp_path):
    """A tiny real MP4 (3s, video + audio) for upload/processing tests."""
    out = tmp_path / "sample.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-f", "lavfi", "-i", "testsrc=duration=3:size=320x240:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", str(out),
        ],
        check=True,
    )
    return out


@pytest.fixture(autouse=True)
def isolated_workdir(tmp_path, monkeypatch):
    """Run every test in its own temp CWD so the app's relative temp/ writes are
    isolated and never touch the developer's working tree."""
    monkeypatch.chdir(tmp_path)
    os.makedirs("temp/clips_out", exist_ok=True)
    os.makedirs("demo", exist_ok=True)
    yield


@pytest.fixture(autouse=True)
def mock_externals(monkeypatch):
    """Mock every paid/external dependency; leave FFmpeg real."""
    # Transcription + GPT moment finding.
    monkeypatch.setattr(api, "transcribe_audio", lambda *a, **k: make_transcript())
    monkeypatch.setattr(api, "find_best_moments", lambda *a, **k: [dict(m) for m in FAKE_MOMENTS])

    # Storage: always use local /clips (no R2).
    monkeypatch.setattr(api.storage, "enabled", lambda: False)

    # OpenAI client used by /parse-intent and /animate.
    def fake_create(*args, **kwargs):
        msg = Mock()
        if "response_format" in kwargs:  # /parse-intent expects a JSON object
            msg.content = json.dumps({"steps": [{"action": "find_best_moments", "count": 1}]})
        else:  # /animate expects component code
            msg.content = "export const Generated = () => null;"
        return Mock(choices=[Mock(message=msg)])

    fake_client = Mock()
    fake_client.chat.completions.create.side_effect = fake_create
    monkeypatch.setattr(api, "client", fake_client)

    # Disable rate limiting so the suite never trips slowapi's 10/hour limits.
    monkeypatch.setattr(api.limiter, "enabled", False)
    yield


def make_clip(path, sample_video):
    """Copy the sample video to a clips_out path the endpoints expect to find."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    shutil.copy(str(sample_video), path)
    return path
