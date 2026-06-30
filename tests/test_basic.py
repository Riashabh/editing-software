"""Integration tests for the lightweight endpoints (no heavy FFmpeg work)."""
import io
import os


def test_health(client):
    r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"status": "running"}


def test_cleanup(client):
    # Drop a file in temp/, then ensure cleanup wipes it and recreates clips_out.
    with open("temp/stale.txt", "w") as f:
        f.write("x")
    r = client.post("/cleanup")
    assert r.status_code == 200
    assert r.json() == {"status": "cleaned"}
    assert not os.path.exists("temp/stale.txt")
    assert os.path.isdir("temp/clips_out")


def test_demo_video_missing_returns_404(client):
    r = client.post("/demo-process") if False else client.get("/demo-video")
    assert r.status_code == 404


def test_demo_video_served_when_present(client, sample_video):
    import shutil
    shutil.copy(str(sample_video), "demo/demo.mp4")
    r = client.get("/demo-video")
    assert r.status_code == 200
    assert r.headers["content-type"] == "video/mp4"


def test_parse_intent_returns_steps(client):
    r = client.post("/parse-intent", json={"message": "find the best moment", "context": {}})
    assert r.status_code == 200
    body = r.json()
    assert "steps" in body
    assert isinstance(body["steps"], list)


def test_parse_intent_with_editor_context(client):
    # Context with an active clip should still return valid steps (mocked LLM).
    r = client.post(
        "/parse-intent",
        json={"message": "add subtitles", "context": {"hasActiveClip": True, "hasSubtitles": False, "clipMode": "single"}},
    )
    assert r.status_code == 200
    assert "steps" in r.json()


def test_download_rejects_non_https(client):
    r = client.get("/download", params={"url": "http://example.com/x.mp4"})
    assert r.status_code == 403


def test_download_rejects_disallowed_host(client, monkeypatch):
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://r2.example.com")
    r = client.get("/download", params={"url": "https://evil.example.org/x.mp4"})
    assert r.status_code == 403


def test_download_allows_r2_host(client, monkeypatch):
    monkeypatch.setenv("R2_ENDPOINT_URL", "https://r2.example.com")

    class FakeResp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            self.close()

    monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: FakeResp(b"VIDEOBYTES"))
    r = client.get("/download", params={"url": "https://r2.example.com/bucket/clip.mp4"})
    assert r.status_code == 200
    assert r.content == b"VIDEOBYTES"
    assert "attachment" in r.headers["content-disposition"]
