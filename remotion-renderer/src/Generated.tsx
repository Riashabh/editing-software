import React from 'react';
import {useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill, Sequence} from 'remotion';

const Animation: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps} = useVideoConfig();

	const springConfig = {
		fps,
		frame,
		config: {
			mass: 1,
			tension: 100,
			friction: 10,
		},
	};

	const titleSpring = spring(springConfig);
	const subtitleSpring = spring({...springConfig, frame: frame - 15});

	const titleOpacity = interpolate(frame, [0, 30], [0, 1]);
	const subtitleOpacity = interpolate(frame, [15, 45], [0, 1]);

	const backgroundScale = interpolate(frame, [0, 30], [0.8, 1.2]);

	return (
		<AbsoluteFill style={{backgroundColor: '#000', overflow: 'hidden'}}>
			<AbsoluteFill style={{
				background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
				opacity: 0.8,
				transform: `scale(${backgroundScale})`,
				borderRadius: '50%',
			}} />
			<Sequence from={0} durationInFrames={90}>
				<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center'}}>
					<div style={{
						fontFamily: 'Arial, sans-serif',
						fontSize: '150px',
						fontWeight: 900,
						color: 'white',
						opacity: titleOpacity,
						transform: `translateY(${interpolate(titleSpring, [0, 1], [200, 0])}px)`,
					}}>
						ISSC Podcast
					</div>
					<div style={{
						fontFamily: 'Arial, sans-serif',
						fontSize: '80px',
						fontWeight: 900,
						color: 'white',
						opacity: subtitleOpacity,
						marginTop: '20px',
						transform: `translateY(${interpolate(subtitleSpring, [0, 1], [200, 0])}px)`,
					}}>
						Subtle Animation
					</div>
				</AbsoluteFill>
			</Sequence>
		</AbsoluteFill>
	);
};

export default Animation;