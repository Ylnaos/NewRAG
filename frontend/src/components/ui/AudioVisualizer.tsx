import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    isListening: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isListening }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();

    // Self-contained simulation state
    const simulationRef = useRef({
        phase: 0,
        currentAmplitude: 0,
        targetAmplitude: 0,
        nextChangeTime: 0
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            if (!canvas || !ctx) return;

            // Clear with transparency
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            const width = canvas.width;
            const state = simulationRef.current;

            // Simulation Logic
            const now = Date.now();
            if (now > state.nextChangeTime) {
                // Pick a new target amplitude: mostly quiet (0-10), occasionally loud (20-40)
                const isSpeaking = Math.random() > 0.6; // 40% chance of speaking burst
                state.targetAmplitude = isSpeaking ? Math.random() * 30 + 10 : Math.random() * 5;
                state.nextChangeTime = now + Math.random() * 500 + 200; // Change every 200-700ms
            }

            // Smoothly interpolate current amplitude towards target
            state.currentAmplitude += (state.targetAmplitude - state.currentAmplitude) * 0.1;

            // If checking strict "isListening" prop (it's always true in this context, 
            // but useful if we ever toggle it off while keeping visualizer mounted)
            const activeAmp = isListening ? state.currentAmplitude : 0;

            // Always draw the base line (idle state core)
            // Even when moving, there's a central energy

            if (activeAmp < 2) {
                // Render as "Straight Line with Glow" (Silence)
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);

                // Glow
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(99, 102, 241, 0.5)';
                ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Core
                ctx.beginPath();
                ctx.moveTo(0, centerY);
                ctx.lineTo(width, centerY);
                ctx.shadowBlur = 0;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = 1;
                ctx.stroke();

            } else {
                // Render as "Wave" (Speaking)
                ctx.shadowBlur = 0;

                // Primary Wave
                ctx.beginPath();
                ctx.strokeStyle = '#6366f1';
                ctx.lineWidth = 3;

                for (let x = 0; x < width; x++) {
                    const frequency = 0.05;
                    // Use activeAmp to modulate height
                    const y = centerY +
                        Math.sin(x * frequency + state.phase) * activeAmp * Math.sin(state.phase * 0.5);

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();

                // Secondary Accent Wave (Pink/Purple) - slightly different phase/amp
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(236, 72, 153, 0.6)'; // Pink accent
                ctx.lineWidth = 2;
                for (let x = 0; x < width; x += 5) {
                    const y = centerY + Math.sin(x * 0.03 - state.phase) * (activeAmp * 0.7);
                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }
                ctx.stroke();
            }

            state.phase += 0.15; // Always increment phase
            animationRef.current = requestAnimationFrame(draw);
        };

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        draw();

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
            window.removeEventListener('resize', resize);
        };
    }, [isListening]);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            background: 'transparent',
        }}>
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};
