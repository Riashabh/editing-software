import React from "react";
import { Composition, registerRoot } from "remotion";
import Animation from "./Generated";

const RemotionRoot = () => {
  return (
    <Composition
      id="Animation"
      component={Animation}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};

registerRoot(RemotionRoot);
