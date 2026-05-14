import { NextResponse } from 'next/server';

let cache: { data: unknown; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  try {
    const now = Date.now();
    if (cache.data && now - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ events: [] });
    }

    // Get this week's range
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const from = monday.toISOString().split('T')[0];
    const to = sunday.toISOString().split('T')[0];

    const url = `https://financialmodelingprep.com/stable/economic-calendar?from=${from}&to=${to}&apikey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (!res.ok) {
      throw new Error(`FMP calendar error: ${res.status}`);
    }

    const data = await res.json();

    // Filter for US/CA, medium+ impact, and sort by date
    const events = (Array.isArray(data) ? data : [])
      .filter((e: { country?: string; impact?: string }) => {
        const country = (e.country || '').toUpperCase();
        return (country === 'US' || country === 'CA' || country === 'UNITED STATES' || country === 'CANADA');
      })
      .filter((e: { impact?: string }) => {
        const impact = (e.impact || '').toLowerCase();
        return impact === 'high' || impact === 'medium';
      })
      .sort((a: { date?: string }, b: { date?: string }) =>
        new Date(a.date || '').getTime() - new Date(b.date || '').getTime()
      )
      .slice(0, 15)
      .map((e: { date?: string; event?: string; country?: string; impact?: string; actual?: number | null; estimate?: number | null; previous?: number | null }) => ({
        date: e.date || '',
        event: e.event || '',
        country: (e.country || '').toUpperCase().includes('CA') ? 'CA' : 'US',
        impact: (e.impact || '').toLowerCase(),
        actual: e.actual ?? null,
        estimate: e.estimate ?? null,
        previous: e.previous ?? null,
      }));

    const result = { events };
    cache = { data: result, timestamp: now };
    return NextResponse.json(result);
  } catch (error) {
    console.error('Economic calendar error:', error);
    if (cache.data) return NextResponse.json(cache.data);
    return NextResponse.json({ events: [] });
  }
}
