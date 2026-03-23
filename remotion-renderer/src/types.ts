export type CaptionWord = {
  start: number;
  end: number;
  text: string;
};

export type CaptionRenderProps = {
  videoPath: string;
  captions: CaptionWord[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};
