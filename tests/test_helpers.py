"""Unit tests for the pure helper functions in the app module (no I/O, no mocks)."""
import pytest


def test_hex_to_ass_basic(api_module):
    # ASS uses &H00BBGGRR ordering; white stays FFFFFF, red becomes 0000FF.
    assert api_module.hex_to_ass("#ffffff") == "&H00FFFFFF"
    assert api_module.hex_to_ass("#ff0000") == "&H000000FF"
    assert api_module.hex_to_ass("#0000ff") == "&H00FF0000"


def test_hex_to_ass_without_hash(api_module):
    assert api_module.hex_to_ass("00ff00") == "&H0000FF00"


def test_seconds_to_srt_ts(api_module):
    assert api_module._seconds_to_srt_ts(0) == "00:00:00,000"
    assert api_module._seconds_to_srt_ts(1.5) == "00:00:01,500"
    assert api_module._seconds_to_srt_ts(3661.25) == "01:01:01,250"


def test_subtitles_to_json_shape(api_module):
    subs = [(0.0, 1.0, "hello", [{"word": "hello", "start": 0.0, "end": 1.0}])]
    out = api_module.subtitles_to_json(subs)
    assert out == [
        {"start": 0.0, "end": 1.0, "text": "hello", "words": [{"word": "hello", "start": 0.0, "end": 1.0}]}
    ]


def test_subtitles_to_json_empty(api_module):
    assert api_module.subtitles_to_json([]) == []
