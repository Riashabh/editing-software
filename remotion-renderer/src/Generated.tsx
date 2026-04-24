import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Sequence } from 'remotion';

const Animation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const springConfig = {
    fps,
    damping: 10,
    mass: 1,
    stiffness: 100,
  };

  const textSpring = spring({ frame: frame - 10, ...springConfig });
  const textTranslateY = interpolate(textSpring, [0, 1], [height, 0]);

  const glowOpacity = interpolate(frame, [0, 30, 60, 90], [0, 1, 1, 0]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
          position: 'absolute',
          width: '150%',
          height: '150%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,0,0,0) 70%)',
          filter: 'blur(100px)',
          opacity: glowOpacity
        }} 
      />
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill style={{ transform: `translateY(${textTranslateY}px)`, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            fontSize: 160,
            fontWeight: 900,
            color: 'white',
            textAlign: 'center',
            opacity: interpolate(frame, [60, 90], [1, 0])
          }}>
            Thank You!
          </div>
        </AbsoluteFill>
      </Sequence>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, rgba(0,0,255,0.3) 0%, rgba(0,255,255,0) 60%)',
          transform: `rotate(${frame}deg)`,
          opacity: 0.4
        }} 
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default Animation;