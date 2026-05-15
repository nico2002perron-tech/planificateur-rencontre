'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useLeadStats } from '@/lib/hooks/useLeads';
import { LEAD_STATUS_LABELS } from '@/lib/prospection/types';
import type { LeadStatus } from '@/lib/prospection/types';
import { Phone, Target, Users, TrendingUp, BarChart2, Award } from 'lucide-react';

export default function StatsPage() {
  const { stats, isLoading } = useLeadStats();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-24 text-text-muted">
        Impossible de charger les statistiques
      </div>
    );
  }

  const statusEntries = Object.entries(stats.by_status || {}) as [LeadStatus, number][];
  const total = statusEntries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div>
      <PageHeader title="Statistiques de prospection" description="Vos performances de prospection" />

      {/* Big numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <BigStat icon={<Users className="h-6 w-6" />} value={stats.total_pool} label="Leads dans le pool" color="blue" />
        <BigStat icon={<Phone className="h-6 w-6" />} value={stats.my_leads} label="Mes leads" color="cyan" />
        <BigStat icon={<BarChart2 className="h-6 w-6" />} value={stats.my_calls} label="Total activités" color="amber" />
        <BigStat icon={<Target className="h-6 w-6" />} value={`${stats.conversion_rate}%`} label="Taux de conversion" color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <Card>
          <CardTitle>Mon pipeline</CardTitle>
          <div className="mt-4 space-y-3">
            {statusEntries.length === 0 ? (
              <p className="text-sm text-text-light text-center py-4">Aucune donnée</p>
            ) : (
              statusEntries.map(([status, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-text-main font-medium">
                        {LEAD_STATUS_LABELS[status] || status}
                      </span>
                      <span className="text-text-muted">{count} ({pct}%)</span>
                    </div>
                    <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: getStatusColor(status),
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* By profession */}
        <Card>
          <CardTitle>Par profession</CardTitle>
          <div className="mt-4 space-y-2">
            {stats.by_profession.length === 0 ? (
              <p className="text-sm text-text-light text-center py-4">Aucune donnée</p>
            ) : (
              stats.by_profession.map((p, i) => (
                <div key={p.profession} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="text-sm text-text-main">{p.profession || 'Non spécifié'}</span>
                  </div>
                  <span className="text-sm font-semibold text-text-main">{p.count}</span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Summary card */}
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-amber-50">
              <Award className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>Résumé</CardTitle>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-2xl font-bold text-text-main">{stats.my_meetings}</p>
              <p className="text-sm text-text-muted">Rendez-vous obtenus</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main">{stats.my_conversions}</p>
              <p className="text-sm text-text-muted">Convertis en clients</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main">
                {stats.my_leads > 0 ? Math.round((stats.my_meetings / stats.my_leads) * 100) : 0}%
              </p>
              <p className="text-sm text-text-muted">Taux de rendez-vous</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-text-main">{stats.conversion_rate}%</p>
              <p className="text-sm text-text-muted">Taux de conversion final</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BigStat({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-text-main">{value}</p>
          <p className="text-xs text-text-muted">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: '#3b82f6',
    contacted: '#f59e0b',
    qualified: '#10b981',
    meeting: '#8b5cf6',
    client: '#059669',
    lost: '#ef4444',
  };
  return colors[status] || '#94a3b8';
}
