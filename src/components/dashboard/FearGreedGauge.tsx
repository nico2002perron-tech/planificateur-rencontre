'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';

interface FearGreedData {
  value: number;
  label: string;
  previousClose: number;
  timestamp: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function getEmoji(value: number) {
  if (value <= 20) return '😱';
  if (value <= 40) return '😰';
  if (value <= 60) return '😐';
  if (value <= 80) return '😊';
  return '🤑';
}

function getLabel(value: number) {
  if (value <= 20) return 'Peur extrême';
  if (value <= 40) return 'Peur';
  if (value <= 60) return 'Neutre';
  if (value <= 80) return 'Avidité';
  return 'Avidité extrême';
}

function getLabelColor(value: number) {
  if (value <= 20) return 'text-red-600';
  if (value <= 40) return 'text-orange-500';
  if (value <= 60) return 'text-yellow-500';
  if (value <= 80) return 'text-lime-500';
  return 'text-emerald-500';
}

export function FearGreedGauge() {
  const { data, isLoading } = useSWR<FearGreedData>(
    '/api/dashboard/fear-greed',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 }
  );

  const [animatedValue, setAnimatedValue] = useState(0);
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef<number | null>(null);

  const value = data?.value ?? 50;
  const previousClose = data?.previousClose ?? value;
  const change = value - previousClose;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Animate needle
  useEffect(() => {
    if (!mounted || isLoading) return;

    const startTime = performance.now();
    const duration = 1500;
    const startVal = 0;
    const endVal = value;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out elastic
      const eased = progress === 1
        ? 1
        : 1 - Math.pow(2, -10 * progress) * Math.cos((progress * 10 - 0.75) * ((2 * Math.PI) / 3));
      setAnimatedValue(startVal + (endVal - startVal) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, mounted, isLoading]);

  // SVG gauge geometry
  const cx = 150;
  const cy = 140;
  const r = 110;
  const startAngle = Math.PI;
  const endAngle = 2 * Math.PI;
  const needleAngle = startAngle + (animatedValue / 100) * (endAngle - startAngle);

  // Arc path helper
  function describeArc(start: number, end: number) {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = end - start > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  // Skeleton
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[var(--shadow-card)] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-2/3 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-6 w-1/2 mx-auto bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-white rounded-2xl shadow-[var(--shadow-card)] p-6
        transition-all duration-500 ease-out
        hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]
        ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}
      `}
    >
      <style>{`
        @keyframes pulseGlow {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(0,180,216,0.2)); }
          50% { filter: drop-shadow(0 0 12px rgba(0,180,216,0.4)); }
        }
        .gauge-needle {
          transform-origin: ${cx}px ${cy}px;
          transition: transform 0.3s ease;
        }
        .gauge-svg {
          animation: pulseGlow 3s ease-in-out infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold font-[family-name:var(--font-heading)] text-text-main">
          Fear & Greed Index
        </h3>
        <span className="text-xs text-text-muted bg-gray-50 px-2 py-0.5 rounded-full">
          CNN
        </span>
      </div>

      {/* SVG Gauge */}
      <div className="flex justify-center">
        <svg viewBox="0 0 300 165" className="gauge-svg w-full max-w-[280px]">
          <defs>
            <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="25%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="75%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d={describeArc(startAngle, endAngle)}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Colored arc */}
          <path
            d={describeArc(startAngle, endAngle)}
            fill="none"
            stroke="url(#gaugeGrad)"
            strokeWidth="20"
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = startAngle + (tick / 100) * (endAngle - startAngle);
            const x1 = cx + (r - 16) * Math.cos(angle);
            const y1 = cy + (r - 16) * Math.sin(angle);
            const x2 = cx + (r + 16) * Math.cos(angle);
            const y2 = cy + (r + 16) * Math.sin(angle);
            return (
              <line key={tick} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d1d5db" strokeWidth="2" />
            );
          })}

          {/* Needle */}
          <line
            x1={cx}
            y1={cy}
            x2={cx + (r - 30) * Math.cos(needleAngle)}
            y2={cy + (r - 30) * Math.sin(needleAngle)}
            stroke="var(--brand-dark, #03045e)"
            strokeWidth="3"
            strokeLinecap="round"
            className="gauge-needle"
          />

          {/* Needle center dot */}
          <circle cx={cx} cy={cy} r="6" fill="var(--brand-dark, #03045e)" />
          <circle cx={cx} cy={cy} r="3" fill="white" />

          {/* Labels along the arc */}
          <text x="18" y="148" fontSize="8" fill="#586e82" textAnchor="start">Peur extrême</text>
          <text x="282" y="148" fontSize="8" fill="#586e82" textAnchor="end">Avidité extrême</text>
          <text x="150" y="25" fontSize="8" fill="#586e82" textAnchor="middle">Neutre</text>
        </svg>
      </div>

      {/* Value display */}
      <div className="text-center -mt-2">
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-extrabold font-[family-name:var(--font-heading)] text-text-main">
            {Math.round(animatedValue)}
          </span>
          <span className="text-3xl" role="img" aria-label="sentiment">
            {getEmoji(value)}
          </span>
        </div>
        <p className={`text-sm font-bold mt-1 ${getLabelColor(value)}`}>
          {getLabel(value)}
        </p>

        {/* Previous close comparison */}
        <div className="flex items-center justify-center gap-1 mt-2">
          <span className="text-xs text-text-muted">vs hier :</span>
          <span className={`text-xs font-bold flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(0)} pts
          </span>
        </div>
      </div>
    </div>
  );
}
