from extractor import extract_frames, extract_audio

video = "test.mp4"  # drop any mp4 in the folder

frames = extract_frames(video)
audio = extract_audio(video)