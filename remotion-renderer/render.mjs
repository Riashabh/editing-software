import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  getCompositions,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputArg = process.argv[2];
if (!inputArg) {
  console.error("Usage: node render.mjs <input-json-path>");
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`Input JSON not found: ${inputPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const {
  videoPath,
  outputPath,
  captions,
  width = 608,
  height = 1080,
  fps = 30,
  durationInFrames,
} = payload;

if (!videoPath || !outputPath) {
  console.error("input json must include videoPath and outputPath");
  process.exit(1);
}

const resolvedVideoPath = path.resolve(path.dirname(inputPath), videoPath);
const resolvedOutputPath = path.resolve(path.dirname(inputPath), outputPath);
const duration =
  typeof durationInFrames === "number" && durationInFrames > 0
    ? durationInFrames
    : Math.max(
        1,
        Math.ceil(
          (captions?.[captions.length - 1]?.end ? captions[captions.length - 1].end : 1) * fps
        )
      );

const inputProps = {
  videoPath: resolvedVideoPath,
  outputPath: resolvedOutputPath,
  captions: captions ?? [],
  width,
  height,
  fps,
  durationInFrames: duration,
};

const entryPoint = path.join(__dirname, "src", "index.ts");
const serveUrl = await bundle({ entryPoint, webpackOverride: (config) => config });
const compositions = await getCompositions(serveUrl, { inputProps });
const composition = selectComposition({
  id: "CaptionVideo",
  compositions,
});

fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  outputLocation: resolvedOutputPath,
  inputProps,
});

console.log(`Remotion render complete: ${resolvedOutputPath}`);
