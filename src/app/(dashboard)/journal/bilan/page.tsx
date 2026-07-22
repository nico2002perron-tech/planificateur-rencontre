'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis,
  CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, Cell,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { ChevronLeft, Target, TrendingUp, TrendingDown, CheckCircle2, XCircle, Hourglass, Crosshair } from 'lucide-react';

// Le bilan agrège au niveau symbole/prédiction — aucun nom de client n'est
// affiché, donc aucun déchiffrement (coffre) n'est requis ici.
type Snapshot = {
  id: string;
  symbol: string;
  name: string;
  entry_type?: 'price_target' | 'model_portfolio' | null;
  conviction: number | null;
  horizon_months: number;
  current_price: number | null;
  target_price: number | null;
  expected_gain_pct: number | null;
  predicted_at: string;
  resolved_at: string | null;
  actual_price: number | null;
  actual_gain_pct: number | null;
  hit: boolean | null;
  peak_price: number | null;
  peak_at: string | null;
  trough_price: number | null;
};

const BRAND = '#00b4d8';
const GREEN = '#10b981';
const RED = '#ef4444';

function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)} %`;
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  try { return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(s)); }
  catch { return s; }
}
function gainColor(v: number | null | undefined): string {
  if (v == null) return 'text-text-muted';
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-600' : 'text-text-muted';
}
function dueDate(iso: string, horizonMonths: number): Date {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + (horizonMonths || 12));
  return d;
}
function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
} as const;

export default function BilanPage() {
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/price-target-snapshots?limit=2000');
        if (!res.ok) throw new Error();
        setSnapshots(await res.json());
      } catch {
        toast('error', 'Impossible de charger le bilan');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  // Le bilan mesure la CALIBRATION du conseiller : ses vraies convictions
  // montrées en rencontre. Les portefeuilles modèles (page Proposition) sont
  // des propositions commerciales — exclus des statistiques par défaut ;
  // un sélecteur permet de les regarder à part ou de tout mélanger.
  const [scope, setScope] = useState<'targets' | 'models' | 'all'>('targets');
  const scoped = useMemo(
    () => scope === 'all'
      ? snapshots
      : snapshots.filter(s => scope === 'models'
          ? s.entry_type === 'model_portfolio'
          : s.entry_type !== 'model_portfolio'),
    [snapshots, scope]
  );
  const hasModelRows = useMemo(
    () => snapshots.some(s => s.entry_type === 'model_portfolio'),
    [snapshots]
  );
  const resolved = useMemo(
    () => scoped.filter(s => s.resolved_at && s.hit != null),
    [scoped]
  );
  const pending = useMemo(
    () => scoped.filter(s => !s.resolved_at),
    [scoped]
  );

  // ── KPIs globaux ───────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const hits = resolved.filter(s => s.hit).length;
    const hitRate = resolved.length ? (hits / resolved.length) * 100 : null;
    const avgPredicted = mean(resolved.map(s => s.expected_gain_pct).filter((v): v is number => v != null));
    const avgRealized = mean(resolved.map(s => s.actual_gain_pct).filter((v): v is number => v != null));
    return { hits, hitRate, avgPredicted, avgRealized };
  }, [resolved]);

  // ── Calibration par conviction ─────────────────────────────────────────
  const byConviction = useMemo(() => {
    const levels = [1, 2, 3, 4, 5];
    return levels.map(level => {
      const rows = resolved.filter(s => s.conviction === level);
      const hits = rows.filter(s => s.hit).length;
      return {
        level,
        n: rows.length,
        hitRate: rows.length ? Math.round((hits / rows.length) * 100) : null,
        avgRealized: mean(rows.map(s => s.actual_gain_pct).filter((v): v is number => v != null)),
      };
    });
  }, [resolved]);

  // ── Nuage prédit vs réalisé ────────────────────────────────────────────
  const scatter = useMemo(
    () => resolved
      .filter(s => s.expected_gain_pct != null && s.actual_gain_pct != null)
      .map(s => ({
        predicted: Math.round(s.expected_gain_pct!),
        realized: Math.round(s.actual_gain_pct!),
        symbol: s.symbol,
        hit: s.hit,
      })),
    [resolved]
  );
  const scatterDomain = useMemo(() => {
    if (scatter.length === 0) return [-20, 40] as [number, number];
    const vals = scatter.flatMap(p => [p.predicted, p.realized]);
    const lo = Math.min(0, ...vals);
    const hi = Math.max(0, ...vals);
    const pad = Math.max(5, Math.round((hi - lo) * 0.1));
    return [lo - pad, hi + pad] as [number, number];
  }, [scatter]);

  // ── Meilleurs / pires appels (résolus) ─────────────────────────────────
  const ranked = useMemo(
    () => [...resolved]
      .filter(s => s.actual_gain_pct != null)
      .sort((a, b) => (b.actual_gain_pct ?? 0) - (a.actual_gain_pct ?? 0)),
    [resolved]
  );
  const best = ranked.slice(0, 5);
  const worst = ranked.slice(-5).reverse();

  // ── Échéances à venir (non résolues, par date d'échéance) ──────────────
  const upcoming = useMemo(
    () => pending
      .filter(s => s.target_price != null)
      .map(s => {
        const due = dueDate(s.predicted_at, s.horizon_months);
        const touched =
          s.peak_price != null && s.target_price != null && s.current_price != null
            ? (s.target_price >= s.current_price ? s.peak_price >= s.target_price
              : (s.trough_price != null && s.trough_price <= s.target_price))
            : false;
        return { s, due, touched };
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime())
      .slice(0, 12),
    [pending]
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner /></div>;
  }

  return (
    <div>
      <Link href="/journal" className="flex items-center gap-1 text-sm font-semibold text-text-muted hover:text-text-main mb-3">
        <ChevronLeft className="h-4 w-4" /> Journal des cibles
      </Link>
      <PageHeader
        title="Bilan des cours cibles"
        description="Ta feuille de route : ce que tu as prédit, ce qui s'est réalisé. La conviction tient-elle ses promesses?"
      />

      {/* Portée : par défaut les vrais cours cibles seulement — les portefeuilles
          modèles (propositions) se consultent à part pour ne pas fausser la calibration */}
      {hasModelRows && (
        <div className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1 mb-4">
          {([
            { v: 'targets' as const, label: 'Cours cibles' },
            { v: 'models' as const, label: 'Portefeuilles modèles' },
            { v: 'all' as const, label: 'Tout' },
          ]).map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setScope(opt.v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                scope === opt.v ? 'bg-white text-text-main shadow-sm' : 'text-text-muted hover:text-text-main'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {resolved.length === 0 ? (
        <Card className="text-center py-16">
          <Hourglass className="h-8 w-8 text-text-muted mx-auto mb-3" />
          <div className="text-sm font-semibold text-text-main">Aucune prédiction résolue pour l&apos;instant</div>
          <div className="text-xs text-text-muted mt-1 max-w-md mx-auto">
            Une prédiction se résout automatiquement quand son horizon est atteint.
            {pending.length > 0 && <> {pending.length} prédiction{pending.length > 1 ? 's' : ''} en cours — voir les échéances ci-dessous.</>}
          </div>
        </Card>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Kpi
              icon={<Target className="h-4 w-4" />}
              label="Taux de réussite"
              value={kpi.hitRate != null ? `${Math.round(kpi.hitRate)} %` : '—'}
              hint={`${kpi.hits}/${resolved.length} cible${resolved.length > 1 ? 's' : ''} touchée${kpi.hits > 1 ? 's' : ''}`}
              accent={BRAND}
            />
            <Kpi
              icon={<Crosshair className="h-4 w-4" />}
              label="Gain visé (moy.)"
              value={fmtPct(kpi.avgPredicted)}
              hint="sur les prédictions résolues"
              valueClass={gainColor(kpi.avgPredicted)}
            />
            <Kpi
              icon={kpi.avgRealized != null && kpi.avgRealized >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              label="Gain réalisé (moy.)"
              value={fmtPct(kpi.avgRealized)}
              hint="prix d'alors → échéance"
              valueClass={gainColor(kpi.avgRealized)}
            />
            <Kpi
              icon={<Hourglass className="h-4 w-4" />}
              label="En cours"
              value={String(pending.length)}
              hint="prédictions non échues"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* ── Calibration par conviction ── */}
            <Card>
              <h2 className="text-sm font-bold text-text-main mb-1">Calibration par conviction</h2>
              <p className="text-xs text-text-muted mb-4">Plus ta conviction est haute, plus le taux de réussite devrait l&apos;être. C&apos;est le test de ton jugement.</p>
              <div className="space-y-3">
                {byConviction.map(c => (
                  <div key={c.level} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      {Array.from({ length: c.level }).map((_, i) => (
                        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: BRAND }} />
                      ))}
                      <span className="text-xs font-bold text-text-muted ml-1">{c.level}</span>
                    </div>
                    <div className="flex-1">
                      <div className="h-5 w-full rounded-full bg-gray-100 overflow-hidden">
                        {c.hitRate != null && (
                          <div className="h-full rounded-full flex items-center justify-end pr-2 transition-all"
                            style={{ width: `${Math.max(c.hitRate, 8)}%`, backgroundColor: c.hitRate >= 50 ? GREEN : RED }}>
                            <span className="text-[10px] font-bold text-white">{c.hitRate} %</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-28 shrink-0 text-right text-xs">
                      {c.n > 0 ? (
                        <><span className={`font-bold ${gainColor(c.avgRealized)}`}>{fmtPct(c.avgRealized)}</span>
                          <span className="text-text-muted"> · {c.n}</span></>
                      ) : <span className="text-text-muted">aucune</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-text-muted mt-3 pt-3 border-t border-gray-50">
                <span>← taux de réussite</span>
                <span>gain réalisé · n →</span>
              </div>
            </Card>

            {/* ── Nuage prédit vs réalisé ── */}
            <Card>
              <h2 className="text-sm font-bold text-text-main mb-1">Prédit vs réalisé</h2>
              <p className="text-xs text-text-muted mb-4">Chaque point = une prédiction résolue. Sur la diagonale = pile dans le mille; au-dessus = mieux que prévu.</p>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 10, right: 15, bottom: 15, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  {/* Quadrant « gagné » (réalisé positif) en vert très léger */}
                  <ReferenceArea y1={0} y2={scatterDomain[1]} fill={GREEN} fillOpacity={0.04} />
                  <XAxis type="number" dataKey="predicted" name="Prédit" unit=" %" domain={scatterDomain}
                    tick={{ fontSize: 11 }} tickLine={false} label={{ value: 'Gain prédit', position: 'insideBottom', offset: -8, fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis type="number" dataKey="realized" name="Réalisé" unit=" %" domain={scatterDomain}
                    tick={{ fontSize: 11 }} tickLine={false} width={44} />
                  <ZAxis range={[60, 60]} />
                  <ReferenceLine segment={[{ x: scatterDomain[0], y: scatterDomain[0] }, { x: scatterDomain[1], y: scatterDomain[1] }]} stroke="#cbd5e1" strokeDasharray="4 4" />
                  <ReferenceLine y={0} stroke="#e5e7eb" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ strokeDasharray: '3 3' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(val: any, name: any) => [`${val >= 0 ? '+' : ''}${val} %`, name]}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={(_l: any, payload: any) => payload?.[0]?.payload?.symbol ?? ''}
                  />
                  <Scatter data={scatter}>
                    {scatter.map((p, i) => (
                      <Cell key={i} fill={p.hit ? GREEN : RED} fillOpacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* ── Meilleurs / pires appels ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <RankCard title="Meilleurs appels" rows={best} positive />
            <RankCard title="Appels les plus difficiles" rows={worst} positive={false} />
          </div>
        </>
      )}

      {/* ── Échéances à venir (toujours visible si des prédictions sont ouvertes) ── */}
      {upcoming.length > 0 && (
        <Card>
          <h2 className="text-sm font-bold text-text-main mb-1">Échéances à venir</h2>
          <p className="text-xs text-text-muted mb-4">Les prochaines prédictions à se résoudre. « Déjà touché » = le prix a atteint la cible au moins une fois.</p>
          <div className="divide-y divide-gray-50">
            {upcoming.map(({ s, due, touched }) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-bold text-text-main text-sm w-20 shrink-0">{s.symbol}</span>
                  <span className="text-xs text-text-muted truncate hidden sm:block">{s.name}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {touched && <Badge variant="success">déjà touché</Badge>}
                  <span className={`text-sm font-semibold ${gainColor(s.expected_gain_pct)}`}>{fmtPct(s.expected_gain_pct)}</span>
                  <span className="text-xs text-text-muted w-24 text-right">{fmtDate(due.toISOString())}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Sous-composants ────────────────────────────────────────────────────────

function Kpi(props: { icon: ReactNode; label: string; value: string; hint?: string; accent?: string; valueClass?: string }) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 text-text-muted mb-2">
        <span style={props.accent ? { color: props.accent } : undefined}>{props.icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide">{props.label}</span>
      </div>
      <div className={`text-2xl font-bold ${props.valueClass ?? 'text-text-main'}`}>{props.value}</div>
      {props.hint && <div className="text-[11px] text-text-muted mt-0.5">{props.hint}</div>}
    </Card>
  );
}

function RankCard({ title, rows, positive }: { title: string; rows: Snapshot[]; positive: boolean }) {
  return (
    <Card>
      <h2 className="text-sm font-bold text-text-main mb-3 flex items-center gap-2">
        {positive ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
        {title}
      </h2>
      {rows.length === 0 ? (
        <div className="text-xs text-text-muted py-4 text-center">Aucune prédiction résolue.</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {rows.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {s.hit ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <XCircle className="h-4 w-4 text-red-400 shrink-0" />}
                <span className="font-bold text-text-main text-sm">{s.symbol}</span>
                <span className="text-xs text-text-muted truncate hidden sm:block">{s.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-text-muted">visé {fmtPct(s.expected_gain_pct)}</span>
                <span className={`text-sm font-bold ${gainColor(s.actual_gain_pct)}`}>{fmtPct(s.actual_gain_pct)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
