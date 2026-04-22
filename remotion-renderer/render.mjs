import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : null;
};

const componentCode = getArg("code")
  ? Buffer.from(getArg("code"), "base64").toString("utf-8")
  : null;
const componentFile = getArg("file");
const outputPath = getArg("output") || "out.mp4";
const durationInFrames = parseInt(getArg("duration") || "90");
const fps = parseInt(getArg("fps") || "30");
const width = parseInt(getArg("width") || "1080");
const height = parseInt(getArg("height") || "1920");

// Write the generated component to a temp file
const generatedPath = join(__dirname, "src", "Generated.tsx");

if (componentCode) {
  writeFileSync(generatedPath, componentCode, "utf-8");
} else if (componentFile) {
  const { readFileSync } = await import("fs");
  const code = readFileSync(componentFile, "utf-8");
  writeFileSync(generatedPath, code, "utf-8");
}

try {
  const bundled = await bundle({
    entryPoint: join(__dirname, "src", "index.tsx"),
    webpackOverride: (config) => config,
  });

  const composition = await selectComposition({
    serveUrl: bundled,
    id: "Animation",
    inputProps: {},
  });

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames,
      fps,
      width,
      height,
    },
    serveUrl: bundled,
    codec: "h264",
    outputLocation: outputPath,
    inputProps: {},
  });

  console.log("RENDER_SUCCESS:" + outputPath);
} catch (err) {
  console.error("RENDER_ERROR:" + err.message);
  process.exit(1);
}
