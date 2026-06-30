"""Integration tests for the FFmpeg pipeline endpoints.

AI/storage are mocked (see conftest); FFmpeg runs for real on a tiny generated clip.
"""
import io
import os

import pytest

from conftest import requires_ffmpeg, make_clip

pytestmark = requires_ffmpeg


def _upload(sample_video):
    return {"file": ("sample.mp4", open(str(sample_video), "rb"), "video/mp4")}


def test_process_single(client, sample_video):
    r = client.post(
        "/process",
        params={"mode": "single", "job_id": "job1", "subtitles": "true"},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "single"
    assert body["video_url"] == "/clips/job1_v.mp4"
    assert body["srt_key"] == "job1"
    assert isinstance(body["subtitles"], list) and len(body["subtitles"]) > 0
    assert os.path.exists("temp/clips_out/job1_v.mp4")


def test_process_single_without_subtitles(client, sample_video):
    r = client.post(
        "/process",
        params={"mode": "single", "job_id": "job2", "subtitles": "false"},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["subtitles"] == []
    assert os.path.exists("temp/clips_out/job2_v.mp4")


def test_process_transcribe_mode(client, sample_video):
    r = client.post(
        "/process",
        params={"mode": "transcribe", "job_id": "job3"},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "transcribe"
    assert body["transcript"] == "hello world this is a test"


def test_process_add_subtitles_mode(client, sample_video):
    r = client.post(
        "/process",
        params={"mode": "add_subtitles", "job_id": "job4"},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "single"
    assert len(body["subtitles"]) > 0
    assert os.path.exists("temp/clips_out/job4_v.mp4")


def test_process_multi_mode(client, sample_video, monkeypatch, api_module):
    # Two moments within the 3s clip → two parallel clips.
    monkeypatch.setattr(
        api_module, "find_best_moments",
        lambda *a, **k: [{"start": 0.0, "end": 1.4}, {"start": 1.5, "end": 2.8}],
    )
    r = client.post(
        "/process",
        params={"mode": "multi", "job_id": "jobm", "count": 2},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "multi"
    assert len(body["clips"]) == 2
    assert os.path.exists("temp/clips_out/jobm_v0.mp4")
    assert os.path.exists("temp/clips_out/jobm_v1.mp4")


def test_crop_16_9(client, sample_video):
    r = client.post(
        "/crop",
        params={"aspectRatio": "16/9", "job_id": "cropjob"},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["aspectRatio"] == "16/9"
    assert body["video_url"] == "/clips/cropjob_cropped.mp4"
    assert os.path.exists("temp/clips_out/cropjob_cropped.mp4")


def test_crop_vertical_9_16_uses_reframe(client, sample_video):
    r = client.post(
        "/crop",
        params={"aspectRatio": "9/16", "job_id": "vjob"},
        files=_upload(sample_video),
    )
    assert r.status_code == 200, r.text
    assert os.path.exists("temp/clips_out/vjob_cropped.mp4")


def test_add_subtitles_to_existing_clip(client, sample_video):
    make_clip("temp/clips_out/subjob_v.mp4", sample_video)
    r = client.post("/add-subtitles", params={"job_id": "subjob"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "single"
    assert body["srt_key"] == "subjob"
    assert len(body["subtitles"]) > 0


def test_add_subtitles_missing_clip_returns_404(client):
    r = client.post("/add-subtitles", params={"job_id": "doesnotexist"})
    assert r.status_code == 404


def test_demo_process(client, sample_video, monkeypatch):
    data = open(str(sample_video), "rb").read()

    class FakeResp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            self.close()

    monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: FakeResp(data))
    r = client.post("/demo-process", params={"job_id": "demojob", "subtitles": "true"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == "single"
    assert body["srt_key"] == "demojob"
    assert os.path.exists("temp/clips_out/demojob_v.mp4")
