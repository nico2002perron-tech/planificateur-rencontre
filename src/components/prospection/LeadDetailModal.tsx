'use client';

import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { Lead, LeadActivity, LeadStatus } from '@/lib/prospection/types';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/prospection/types';
import { useLeadActivities } from '@/lib/hooks/useLeads';
import { Phone, MapPin, Briefcase, Mail, Star, Clock, User } from 'lucide-react';

interface LeadDetailModalProps {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}

export function LeadDetailModal({ open, onClose, lead }: LeadDetailModalProps) {
  const { activities, isLoading } = useLeadActivities(lead?.id || null);

  if (!lead) return null;

  const variant = LEAD_STATUS_COLORS[lead.status as LeadStatus] as 'info' | 'warning' | 'success' | 'danger' | 'default';

  return (
    <Modal open={open} onClose={onClose} title={lead.name} size="lg">
      <div className="space-y-4">
        {/* Lead info */}
        <div className="grid grid-cols-2 gap-3">
          <InfoRow icon={<Briefcase className="h-4 w-4" />} label="Profession" value={lead.profession} />
          <InfoRow icon={<Phone className="h-4 w-4" />} label="Téléphone" value={formatPhone(lead.phone)} />
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="Ville" value={lead.city} />
          {lead.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Courriel" value={lead.email} />}
          {lead.address && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Adresse" value={lead.address} />}
        </div>

        <div className="flex items-center gap-3">
          <Badge variant={variant}>{LEAD_STATUS_LABELS[lead.status as LeadStatus]}</Badge>
          {lead.score && (
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-bold">{lead.score}/10</span>
            </div>
          )}
          {lead.dncl_listed && <Badge variant="danger">Liste LNNTE</Badge>}
          {lead.claimed_by_name && (
            <div className="flex items-center gap-1 text-sm text-text-muted">
              <User className="h-3.5 w-3.5" />
              {lead.claimed_by_name}
            </div>
          )}
        </div>

        {lead.score_reason && (
          <p className="text-sm text-text-muted bg-amber-50 p-2 rounded">{lead.score_reason}</p>
        )}

        {/* Activities */}
        <div>
          <h4 className="font-semibold text-sm text-text-main mb-2">Historique d&apos;activités</h4>
          {isLoading ? (
            <p className="text-sm text-text-muted">Chargement...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-text-light">Aucune activité enregistrée</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {activities.map((a: LeadActivity) => (
                <div key={a.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{a.type}</Badge>
                    {a.outcome && <Badge variant="info">{a.outcome}</Badge>}
                    <span className="text-text-light text-xs ml-auto flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(a.created_at).toLocaleDateString('fr-CA')}
                    </span>
                  </div>
                  {a.notes && <p className="text-text-muted">{a.notes}</p>}
                  {a.ai_summary && (
                    <p className="text-purple-700 bg-purple-50 p-2 rounded mt-1 text-xs">{a.ai_summary}</p>
                  )}
                  {a.next_action && (
                    <p className="text-blue-700 text-xs mt-1">Prochaine action : {a.next_action}
                      {a.next_action_date && ` — ${new Date(a.next_action_date).toLocaleDateString('fr-CA')}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-text-light">{icon}</span>
      <span className="text-text-muted">{label}:</span>
      <span className="text-text-main font-medium">{value || '—'}</span>
    </div>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1') return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return phone;
}
