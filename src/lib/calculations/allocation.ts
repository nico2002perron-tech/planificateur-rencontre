interface HoldingWithValue {
  symbol: string;
  name: string;
  market_value: number;
  asset_class?: string;
  sector?: string;
  region?: string;
}

export interface AllocationSlice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

const COLORS = [
  '#00b4d8', '#03045e', '#0077b6', '#48cae4', '#90e0ef',
  '#023e8a', '#0096c7', '#ade8f4', '#caf0f8', '#264653',
  '#2a9d8f', '#e76f51',
];

export function calculateAllocationBy(
  holdings: HoldingWithValue[],
  key: 'asset_class' | 'sector' | 'region'
): AllocationSlice[] {
  const total = holdings.reduce((sum, h) => sum + h.market_value, 0);
  if (total === 0) return [];

  const groups = new Map<string, number>();
  for (const h of holdings) {
    const group = h[key] || 'Autre';
    groups.set(group, (groups.get(group) || 0) + h.market_value);
  }

  return Array.from(groups.entries())
    .map(([label, value], i) => ({
      label,
      value,
      percentage: (value / total) * 100,
      color: COLORS[i % COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateTopPositions(
  holdings: HoldingWithValue[],
  limit = 5
): HoldingWithValue[] {
  return [...holdings]
    .sort((a, b) => b.market_value - a.market_value)
    .slice(0, limit);
}
