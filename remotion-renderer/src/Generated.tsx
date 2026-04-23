import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Sequence} from 'remotion';

export default function Animation() {
	const frame = useCurrentFrame();
	const {fps, width, height} = useVideoConfig();

	const scale = spring({
		frame,
		fps,
		from: 0,
		to: 1,
		config: {damping: 10},
	});

	const translateY = interpolate(frame, [0, 60], [height, 0], {extrapolateRight: 'clamp'});
	const opacity = interpolate(frame, [45, 90], [0, 1], {extrapolateRight: 'clamp'});

	return (
		<AbsoluteFill style={{backgroundColor: '#282c34', justifyContent: 'center', alignItems: 'center'}}>
			<Sequence from={0} durationInFrames={60}>
				<div
					style={{
						fontSize: 150,
						fontWeight: 900,
						color: '#61dafb',
						transform: `scale(${scale}) translateY(${translateY}px)`,
						textAlign: 'center',
					}}
				>
					Thank You
				</div>
			</Sequence>
			<Sequence from={45} durationInFrames={45}>
				<div
					style={{
						fontSize: 80,
						fontWeight: 900,
						color: '#ffffff',
						transform: `translateY(${translateY}px)`,
						opacity,
						textAlign: 'center',
					}}
				>
					For Watching!
				</div>
			</Sequence>
			<div style={{
				position: 'absolute',
				top: 0,
				left: 0,
				height: '100%',
				width: '100%',
				background: 'radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(97,218,251,0.5) 100%)',
			}} />
		</AbsoluteFill>
	);
}