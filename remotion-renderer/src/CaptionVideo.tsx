import * as React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CaptionRenderProps, CaptionWord } from "./types";

const chunkWords = (words: CaptionWord[], chunkSize = 4): CaptionWord[][] => {
  const chunks: CaptionWord[][] = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize));
  }
  return chunks;
};

type CaptionLineProps = {
  words: CaptionWord[];
};

const CaptionLine = ({ words }: CaptionLineProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  // Fast, deterministic pop animation when line appears.
  const inSpring = spring({
    frame,
    fps,
    config: {
      damping: 16,
      stiffness: 160,
      mass: 0.5,
    },
  });
  const scale = interpolate(inSpring, [0, 1], [0.92, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 120,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.62)",
          borderRadius: 22,
          padding: "18px 24px",
          maxWidth: "90%",
          transform: `scale(${scale})`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        <span
          style={{
            fontFamily:
              "Inter, SF Pro Display, Helvetica Neue, Helvetica, Arial, sans-serif",
            fontWeight: 800,
            fontSize: 54,
            lineHeight: 1.25,
            letterSpacing: 0.2,
            textAlign: "center",
            display: "inline-block",
            color: "#fff",
            textShadow:
              "0 2px 0 rgba(0,0,0,0.8), 0 8px 24px rgba(0,0,0,0.45), 0 0 10px rgba(0,0,0,0.35)",
          }}
        >
          {words.map((w, i) => {
            const active = currentTime >= w.start && currentTime <= w.end;
            return (
              <span
                key={`${w.start}-${w.end}-${i}`}
                style={{
                  color: active ? "#FFD23F" : "#FFFFFF",
                  marginRight: i === words.length - 1 ? 0 : 12,
                  transition: "color 80ms linear",
                }}
              >
                {w.text}
              </span>
            );
          })}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const CaptionVideo = ({
  videoPath,
  captions,
  fps,
}: CaptionRenderProps) => {
  const chunks = chunkWords(captions, 4).filter((c) => c.length > 0);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo src={videoPath} />
      {chunks.map((chunk, idx) => {
        const start = chunk[0]?.start ?? 0;
        const end = chunk[chunk.length - 1]?.end ?? start;
        const startFrame = Math.max(0, Math.floor(start * fps));
        const durationFrames = Math.max(1, Math.ceil((end - start) * fps));

        return (
          <Sequence key={`${start}-${end}-${idx}`} from={startFrame} durationInFrames={durationFrames}>
            <CaptionLine words={chunk} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
