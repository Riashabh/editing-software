"""Integration tests for /export and /animate.

Only the subtitle-burn path and /animate need a libass-capable FFmpeg, so those are
gated with @requires_libass. Plain concat/crop/copy exports use _any_ffmpeg_bin and run
anywhere FFmpeg is present. The Node/Remotion renderer is mocked.
"""
import os
import shutil
import subprocess

import pytest

from conftest import requires_ffmpeg, requires_libass, make_clip


@requires_ffmpeg
def test_export_no_subtitles_returns_video(client, sample_video):
    make_clip("temp/clips_out/expjob_v.mp4", sample_video)
    r = client.post(
        "/export",
        params={"job_id": "expjob"},
        json={"subtitles": [], "segments": [], "aspectRatio": "original"},
    )
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "video/mp4"


@requires_ffmpeg
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


@requires_ffmpeg
def test_export_nle_presigned_url_filename(client, sample_video, monkeypatch):
    """Regression: a presigned R2 URL's long query string must NOT end up in the local
    filename (which would overflow the FS name limit and 500). seg_path uses the URL path
    basename only."""
    presigned = (
        "https://acct.r2.cloudflarestorage.com/clips/remote_v.mp4"
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=" + ("a" * 400)
    )

    def fake_urlretrieve(url, local):
        # The local path must be short/valid — copy the sample there.
        assert len(os.path.basename(local)) < 255, "filename derived from URL is too long"
        shutil.copy(str(sample_video), local)

    monkeypatch.setattr("urllib.request.urlretrieve", fake_urlretrieve)
    r = client.post(
        "/export",
        params={"job_id": "remotejob"},
        json={
            "subtitles": [],
            "aspectRatio": "original",
            "segments": [
                {"source_url": presigned, "timeline_start": 0, "track": "video", "duration": 2}
            ],
        },
    )
    assert r.status_code == 200, r.text
    assert os.path.exists("temp/clips_out/remote_v.mp4")


@requires_libass
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


@requires_libass
def test_animate_with_mocked_renderer(client, sample_video, monkeypatch, api_module, tmp_path):
    make_clip("temp/clips_out/animjob_v.mp4", sample_video)
    monkeypatch.setattr(api_module, "REMOTION_GENERATED", str(tmp_path / "Generated.tsx"))

    real_run = api_module.subprocess.run

    def fake_run(cmd, *a, **k):
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


@requires_libass
def test_animate_missing_clip_returns_404(client):
    r = client.post(
        "/animate",
        params={"prompt": "intro", "job_id": "nope", "duration": 30, "fps": 30},
    )
    assert r.status_code == 404
