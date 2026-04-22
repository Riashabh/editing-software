import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Sequence } from 'remotion';

export default function Animation() {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const bounce = (delay: number) =>
		spring({
			fps,
			frame: frame - delay,
			config: {
				damping: 10,
			},
		});

	const slideUp = (delay: number) =>
		interpolate(frame - delay, [0, 30], [300, 0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});

	const slideInFromLeft = (delay: number) =>
		interpolate(frame - delay, [0, 15], [-500, 0], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});

	const glow = (delay: number) =>
		interpolate(frame - delay, [0, 15], [0, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});

	const scale = (delay: number) =>
		interpolate(frame - delay, [0, 15], [3, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});

	const opacity = (delay: number) =>
		interpolate(frame - delay, [0, 15], [0, 1], {
			extrapolateLeft: 'clamp',
			extrapolateRight: 'clamp',
		});

	return (
		<AbsoluteFill style={{ backgroundColor: 'black' }}>
			<Sequence from={0}>
				<div
					style={{
						transform: `translateY(${slideInFromLeft(0)}px) scale(${scale(0)})`,
						opacity: opacity(0),
						fontSize: 200,
						fontWeight: 900,
						color: 'white',
						textShadow: `0 0 10px rgba(255, 255, 255, ${glow(0)})`,
						width: '100%',
						textAlign: 'center',
						marginTop: '50%',
					}}
				>
					HELLO
				</div>
			</Sequence>

			<Sequence from={15}>
				<div
					style={{
						transform: `translateY(${slideUp(15)}px)`,
						opacity: opacity(15),
						fontSize: 80,
						fontWeight: 900,
						backgroundColor: 'red',
						color: 'white',
						width: 'auto',
						padding: '20px 40px',
						margin: 'auto',
						marginTop: '70%',
						borderRadius: 20,
					}}
				>
					SUBSCRIBE
				</div>
			</Sequence>

			<Sequence from={30}>
				<div
					style={{
						position: 'absolute',
						width: '100%',
						height: '100%',
						background: 'radial-gradient(circle, rgba(255, 0, 150, 0.5) 0%, rgba(0, 0, 0, 0) 70%)',
						transform: `scale(${bounce(30)})`,
						opacity: 0.6,
					}}
				/>
			</Sequence>
		</AbsoluteFill>
	);
}