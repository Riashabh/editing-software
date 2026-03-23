import * as React from "react";
import { Composition } from "remotion";
import { CaptionVideo } from "./CaptionVideo";
import type { CaptionRenderProps } from "./types";

const defaultProps: CaptionRenderProps = {
  videoPath: "",
  captions: [],
  width: 608,
  height: 1080,
  fps: 30,
  durationInFrames: 1,
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="CaptionVideo"
      component={CaptionVideo}
      durationInFrames={defaultProps.durationInFrames}
      fps={defaultProps.fps}
      width={defaultProps.width}
      height={defaultProps.height}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: Math.max(1, props.durationInFrames ?? 1),
          fps: props.fps ?? defaultProps.fps,
          width: props.width ?? defaultProps.width,
          height: props.height ?? defaultProps.height,
        };
      }}
    />
  );
};
