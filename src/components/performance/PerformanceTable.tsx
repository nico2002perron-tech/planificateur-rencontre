import { formatPercent } from '@/lib/utils/format';

interface PerformanceTableProps {
  periods: Record<string, number>;
  benchmarkPeriods?: Record<string, Record<string, number>>;
}

export function PerformanceTable({ periods, benchmarkPeriods }: PerformanceTableProps) {
  const periodKeys = Object.keys(periods);
  const benchmarkNames = benchmarkPeriods ? Object.keys(benchmarkPeriods) : [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-3 px-3 text-xs font-semibold text-text-muted uppercase">
              Période
            </th>
            {periodKeys.map((p) => (
              <th key={p} className="text-right py-3 px-3 text-xs font-semibold text-text-muted uppercase">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-50 font-semibold">
            <td className="py-3 px-3">Portefeuille</td>
            {periodKeys.map((p) => (
              <td
                key={p}
                className={`text-right py-3 px-3 ${periods[p] >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
              >
                {formatPercent(periods[p])}
              </td>
            ))}
          </tr>
          {benchmarkNames.map((name) => (
            <tr key={name} className="border-b border-gray-50">
              <td className="py-3 px-3 text-text-muted">{name}</td>
              {periodKeys.map((p) => {
                const val = benchmarkPeriods?.[name]?.[p] ?? 0;
                return (
                  <td
                    key={p}
                    className={`text-right py-3 px-3 ${val >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {formatPercent(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
