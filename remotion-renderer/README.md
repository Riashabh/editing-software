# Remotion Renderer

This folder renders animated subtitles onto your final vertical video.

## How it connects to Python

`main.py` writes `temp/remotion-input.json` with:

- `videoPath` (final vertical video)
- `outputPath` (render destination)
- `captions` (`[{start, end, text}]`)
- dimensions / fps / duration

Then Python runs:

```bash
node render.mjs ../temp/remotion-input.json
```

## Dev commands

```bash
npm install
npm run preview
```

To render from CLI test composition:

```bash
npm run render:cli
```
