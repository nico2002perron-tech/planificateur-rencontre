'use client';

import { useEffect, useRef } from 'react';

interface AudioWaveformProps {
  stream: MediaStream | null;
  isRecording: boolean;
}

export function AudioWaveform({ stream, isRecording }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || !isRecording || !canvasRef.current) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);

    ctxRef.current = audioCtx;
    analyserRef.current = analyser;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const bars = Math.min(bufferLength, 24);
      const barWidth = Math.max(3, (w - (bars - 1) * 2) / bars);
      const gap = 2;

      for (let i = 0; i < bars; i++) {
        const value = dataArray[i] / 255;
        const barHeight = Math.max(3, value * h * 0.9);
        const x = i * (barWidth + gap) + (w - bars * (barWidth + gap) + gap) / 2;
        const y = (h - barHeight) / 2;

        // Gradient from red-500 to red-400
        const intensity = 0.4 + value * 0.6;
        ctx.fillStyle = `rgba(239, 68, 68, ${intensity})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      source.disconnect();
      audioCtx.close();
      ctxRef.current = null;
      analyserRef.current = null;
    };
  }, [stream, isRecording]);

  if (!isRecording) return null;

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-12 rounded-lg"
      style={{ imageRendering: 'auto' }}
    />
  );
}
