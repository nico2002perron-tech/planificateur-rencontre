import { NextResponse } from 'next/server';

// In-memory cache
let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getLabel(value: number): string {
  if (value <= 25) return 'Peur extrême';
  if (value <= 45) return 'Peur';
  if (value <= 55) return 'Neutre';
  if (value <= 75) return 'Avidité';
  return 'Avidité extrême';
}

export async function GET() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const res = await fetch(
      'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      throw new Error(`CNN API error: ${res.status}`);
    }

    const json = await res.json();
    const fgi = json?.fear_and_greed;
    const previous = json?.fear_and_greed_historical?.previousClose;

    const result = {
      value: Math.round(fgi?.score ?? 50),
      label: getLabel(fgi?.score ?? 50),
      rating: fgi?.rating ?? '',
      previous: previous
        ? { value: Math.round(previous.score), label: getLabel(previous.score) }
        : null,
      timestamp: fgi?.timestamp ?? new Date().toISOString(),
    };

    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Fear & Greed API error:', error);
    // Return fallback if cache exists
    if (cache.data) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json(
      { value: 50, label: 'Neutre', rating: '', previous: null, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }
}
