'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { AllocationSlice } from '@/lib/calculations/allocation';
import { formatCurrency } from '@/lib/utils/format';

interface AllocationPieChartProps {
  data: AllocationSlice[];
  currency?: 'CAD' | 'USD';
  height?: number;
}

export function AllocationPieChart({ data, currency = 'CAD', height = 300 }: AllocationPieChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-text-muted text-sm">
        Aucune donnée
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="label"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            `${formatCurrency(Number(value), currency)} (${((Number(value) / data.reduce((s, d) => s + d.value, 0)) * 100).toFixed(1)}%)`,
            String(name),
          ]}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value: string) => <span className="text-text-main text-xs">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
