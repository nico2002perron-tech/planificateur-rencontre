'use client';

import useSWR from 'swr';

interface YieldPoint {
  term: string;
  years: number;
  yield: number;
}

interface YieldCurveData {
  source: 'cache' | 'live';
  date: string;
  overnight: number | null;
  points: YieldPoint[];
}

interface HistoricalYield {
  date: string;
  yield: number;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useYieldCurve() {
  const { data, error, isLoading } = useSWR<YieldCurveData>(
    '/api/yields',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 } // 10 min
  );

  return {
    curve: data ?? null,
    overnight: data?.overnight ?? null,
    points: data?.points ?? [],
    date: data?.date ?? null,
    isLoading,
    error,
  };
}

export function useHistoricalYields(series: string, recent = 30) {
  const { data, error, isLoading } = useSWR<{ series: string; data: HistoricalYield[] }>(
    `/api/yields?history=${series}&recent=${recent}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 600_000 }
  );

  return {
    data: data?.data ?? [],
    isLoading,
    error,
  };
}
