"""Integration tests for /export and /animate.

These burn subtitles / resolve a libass-capable FFmpeg, so they're skipped when the
local FFmpeg lacks libass. The Node/Remotion renderer is mocked (it would need Node +
Chromium); FFmpeg still runs for real.
"""
import os
import shutil
import subprocess

import pytest

from conftest import requires_libass, make_clip

pytestmark = requires_libass


def test_export_no_subtitles_returns_video(client, sample_video):
    make_clip("temp/clips_out/expjob_v.mp4", sample_video)
    r = client.post(
        "/export",
        params={"job_id": "expjob"},
        json={"subtitles": [], "segments": [], "aspectRatio": "original"},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "video/mp4"


def test_export_with_subtitles_burns_and_returns(client, sample_video):
    make_clip("temp/clips_out/burnjob_v.mp4", sample_video)
    r = client.post(
        "/export",
        params={"job_id": "burnjob"},
        json={
            "subtitles": [{"start": 0.0, "end": 1.0, "text": "hello"}],
            "segments": [],
            "aspectRatio": "original",
        },
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "video/mp4"


def test_export_nle_single_segment(client, sample_video):
    make_clip("temp/clips_out/segclip_v.mp4", sample_video)
    r = client.post(
        "/export",
        params={"job_id": "segjob"},
        json={
            "subtitles": [],
            "aspectRatio": "original",
            "segments": [
                {"source_url": "/clips/segclip_v.mp4", "timeline_start": 0, "track": "video", "duration": 2}
            ],
        },
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "video/mp4"


def test_animate_with_mocked_renderer(client, sample_video, monkeypatch, api_module, tmp_path):
    make_clip("temp/clips_out/animjob_v.mp4", sample_video)

    # Write the generated component to a temp file, not the real renderer dir.
    monkeypatch.setattr(api_module, "REMOTION_GENERATED", str(tmp_path / "Generated.tsx"))

    real_run = api_module.subprocess.run

    def fake_run(cmd, *a, **k):
        # Intercept the Node/Remotion render: produce a real MP4 at --output.
        if isinstance(cmd, (list, tuple)) and cmd and os.path.basename(str(cmd[0])) == "node":
            out = cmd[cmd.index("--output") + 1]
            shutil.copy(str(sample_video), out)
            return subprocess.CompletedProcess(cmd, 0, stdout="RENDER_SUCCESS", stderr="")
        return real_run(cmd, *a, **k)

    monkeypatch.setattr(api_module.subprocess, "run", fake_run)

    r = client.post(
        "/animate",
        params={"prompt": "a hype intro", "job_id": "animjob", "track": "video", "position": 0, "duration": 30, "fps": 30},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "animation"
    assert body["track"] == "video"
    assert "video_url" in body


def test_animate_missing_clip_returns_404(client, monkeypatch, api_module):
    # No clip on disk → 404 before any render work.
    r = client.post(
        "/animate",
        params={"prompt": "intro", "job_id": "nope", "duration": 30, "fps": 30},
    )
    assert r.status_code == 404
