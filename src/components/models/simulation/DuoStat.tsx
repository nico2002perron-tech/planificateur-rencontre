'use client';

export function DuoStat({ label, value, sub, icon, color = '#1CB0F6' }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color?: string;
}) {
  return (
    <div className="rounded-2xl border-[3px] bg-white p-4 transition-all hover:scale-[1.02]"
      style={{ borderColor: color + '30', boxShadow: `0 3px 0 0 ${color}20` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-xl" style={{ backgroundColor: color + '15' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-extrabold" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] font-bold text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}
