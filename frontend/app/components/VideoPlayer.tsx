"use client";
import { useEffect, useRef } from "react";
import { SubStyle, Subtitle } from "./StylePanel";

interface Props {
  videoUrl: string;
  subtitles: Subtitle[];
  style: SubStyle;
}

export default function VideoPlayer({ videoUrl, subtitles, style }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let animFrame: number;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width && rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }


      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const currentTime = video.currentTime;
      const sub = subtitles.find(s => currentTime >= s.start && currentTime <= s.end);

      if (sub && canvas.width > 0) {
        const fontSize = Math.round((style.fontSize / 100) * canvas.height * 0.05);
        ctx.font = `bold ${fontSize}px ${style.fontFamily}, Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const x = canvas.width / 2;
        const y = (style.positionY / 100) * canvas.height;

        if (style.karaoke && sub.words && sub.words.length > 0) {
          // measure total width to center the line
          const wordWidths = sub.words.map(w => ctx.measureText(w.word).width);
          const spaces = (sub.words.length - 1) * ctx.measureText(" ").width;
          const totalWidth = wordWidths.reduce((a, b) => a + b, 0) + spaces;
          let curX = x - totalWidth / 2;

          for (let i = 0; i < sub.words.length; i++) {
            const w = sub.words[i];
            const isActive = currentTime >= w.start && currentTime <= w.end;
            const isPast = currentTime > w.end;
            const wX = curX + wordWidths[i] / 2;

            // outline
            if (style.outline) {
              ctx.shadowColor = "transparent";
              ctx.strokeStyle = style.outlineColor;
              ctx.lineWidth = style.outlineWidth * (canvas.height / 1920);
              ctx.lineJoin = "round";
              ctx.strokeText(w.word, wX, y);
            }

            // shadow
            if (style.shadow) {
              ctx.shadowColor = "rgba(0,0,0,0.85)";
              ctx.shadowBlur = fontSize * 0.3;
              ctx.shadowOffsetX = 3;
              ctx.shadowOffsetY = 3;
            } else {
              ctx.shadowColor = "transparent";
              ctx.shadowBlur = 0;
              ctx.shadowOffsetX = 0;
              ctx.shadowOffsetY = 0;
            }

            ctx.fillStyle = (isActive || isPast) ? style.karaokeColor : style.color;
            ctx.fillText(w.word, wX, y);

            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            curX += wordWidths[i] + ctx.measureText(" ").width;
          }
        } else {
          // normal rendering
          if (style.outline) {
            ctx.shadowColor = "transparent";
            ctx.strokeStyle = style.outlineColor;
            ctx.lineWidth = style.outlineWidth * (canvas.height / 1920);
            ctx.lineJoin = "round";
            ctx.strokeText(sub.text, x, y);
          }

          if (style.shadow) {
            ctx.shadowColor = "rgba(0,0,0,0.85)";
            ctx.shadowBlur = fontSize * 0.3;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
          } else {
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          }

          ctx.fillStyle = style.color;
          ctx.fillText(sub.text, x, y);

          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }
      }

      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame);
  }, [subtitles, style]);

  return (
    <div className="relative w-full" style={{ aspectRatio: style.aspectRatio === "original" ? "16/9" : style.aspectRatio }}>
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        className="w-full h-full rounded-2xl object-cover"
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-2xl pointer-events-none"
      />
    </div>
  );
}
