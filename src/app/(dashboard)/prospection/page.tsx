'use client';

import { useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { SearchInput } from '@/components/ui/SearchInput';
import { Spinner } from '@/components/ui/Spinner';
import { LeadCard } from '@/components/prospection/LeadCard';
import { CallModal } from '@/components/prospection/CallModal';
import { ImportModal } from '@/components/prospection/ImportModal';
import { LeadDetailModal } from '@/components/prospection/LeadDetailModal';
import { useLeadPool, useMyLeads, useLeadStats } from '@/lib/hooks/useLeads';
import type { Lead, LeadStatus } from '@/lib/prospection/types';
import { LEAD_STATUS_LABELS } from '@/lib/prospection/types';
import {
  Upload, Search, Phone, Users, Target, TrendingUp, Sparkles,
  UserPlus, BarChart2
} from 'lucide-react';

const STATUS_TABS: { id: string; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'new', label: 'Nouveaux' },
  { id: 'contacted', label: 'Contactés' },
  { id: 'qualified', label: 'Qualifiés' },
  { id: 'meeting', label: 'Rendez-vous' },
  { id: 'client', label: 'Clients' },
];

export default function ProspectionPage() {
  const [search, setSearch] = useState('');
  const [myFilter, setMyFilter] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [callLead, setCallLead] = useState<Lead | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [scoring, setScoring] = useState(false);

  const { leads: pool, isLoading: loadingPool, mutate: mutatePool } = useLeadPool(search);
  const { leads: myLeads, isLoading: loadingMine, mutate: mutateMine } = useMyLeads(
    myFilter || undefined,
    search
  );
  const { stats } = useLeadStats();

  const claimLead = useCallback(async (lead: Lead) => {
    await fetch(`/api/prospection/leads/${lead.id}/claim`, { method: 'POST' });
    mutatePool();
    mutateMine();
  }, [mutatePool, mutateMine]);

  const saveActivity = useCallback(async (data: Record<string, unknown>) => {
    if (!callLead) return;
    await fetch(`/api/prospection/leads/${callLead.id}/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    mutateMine();
  }, [callLead, mutateMine]);

  async function scoreLeads() {
    setScoring(true);
    await fetch('/api/prospection/ai/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    mutatePool();
    mutateMine();
    setScoring(false);
  }

  const mainTabs = [
    { id: 'pool', label: 'Pool de leads', icon: <Users className="h-4 w-4" /> },
    { id: 'mine', label: 'Mon répertoire', icon: <Phone className="h-4 w-4" /> },
  ];

  return (
    <div>
      <PageHeader
        title="Prospection"
        description="Trouvez et gérez vos leads de prospection"
        action={
          <div className="flex gap-2">
            <Button variant="outline" icon={<Sparkles className="h-4 w-4" />} onClick={scoreLeads} loading={scoring}>
              Scorer les leads
            </Button>
            <Button variant="outline" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>
              Importer
            </Button>
            <Button variant="primary" icon={<Search className="h-4 w-4" />} onClick={() => window.location.href = '/prospection/search'}>
              Scraper
            </Button>
          </div>
        }
      />

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<Users className="h-5 w-5" />} label="Pool disponible" value={stats.total_pool} color="blue" />
          <StatCard icon={<UserPlus className="h-5 w-5" />} label="Mes leads" value={stats.my_leads} color="cyan" />
          <StatCard icon={<Phone className="h-5 w-5" />} label="Mes appels" value={stats.my_calls} color="amber" />
          <StatCard icon={<Target className="h-5 w-5" />} label="Taux conversion" value={`${stats.conversion_rate}%`} color="green" />
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          placeholder="Rechercher par nom, ville, téléphone..."
        />
      </div>

      <Tabs tabs={mainTabs} defaultTab="pool">
        {(activeTab) =>
          activeTab === 'pool' ? (
            <div>
              {loadingPool ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : pool.length === 0 ? (
                <EmptyState
                  message="Aucun lead dans le pool"
                  sub="Importez un fichier ou lancez un scraping pour commencer"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pool.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      showClaim
                      onClaim={claimLead}
                      onClick={setDetailLead}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* Status filter */}
              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setMyFilter(tab.id === 'all' ? '' : tab.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      (tab.id === 'all' && !myFilter) || tab.id === myFilter
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-text-muted hover:bg-gray-200'
                    }`}
                  >
                    {tab.label}
                    {stats?.by_status && tab.id !== 'all' && (
                      <span className="ml-1">({stats.by_status[tab.id as LeadStatus] || 0})</span>
                    )}
                  </button>
                ))}
              </div>

              {loadingMine ? (
                <div className="flex justify-center py-12"><Spinner size="lg" /></div>
              ) : myLeads.length === 0 ? (
                <EmptyState
                  message="Aucun lead dans votre répertoire"
                  sub="Prenez des leads depuis le pool pour commencer"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {myLeads.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onCall={setCallLead}
                      onClick={setDetailLead}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        }
      </Tabs>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onSuccess={() => { mutatePool(); mutateMine(); }} />
      <CallModal open={!!callLead} onClose={() => setCallLead(null)} lead={callLead} onSave={saveActivity} />
      <LeadDetailModal open={!!detailLead} onClose={() => setDetailLead(null)} lead={detailLead} />
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColors[color]}`}>{icon}</div>
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="text-xl font-bold text-text-main">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="text-center py-16">
      <BarChart2 className="h-12 w-12 text-text-light mx-auto mb-3" />
      <p className="text-text-muted font-medium">{message}</p>
      <p className="text-sm text-text-light mt-1">{sub}</p>
    </div>
  );
}
