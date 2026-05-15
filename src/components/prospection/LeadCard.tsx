'use client';

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Lead, LeadStatus } from '@/lib/prospection/types';
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from '@/lib/prospection/types';
import { Phone, MapPin, Briefcase, Star, UserPlus, MessageSquare } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onClaim?: (lead: Lead) => void;
  onCall?: (lead: Lead) => void;
  onClick?: (lead: Lead) => void;
  showClaim?: boolean;
}

export function LeadCard({ lead, onClaim, onCall, onClick, showClaim }: LeadCardProps) {
  const variant = LEAD_STATUS_COLORS[lead.status as LeadStatus] as 'info' | 'warning' | 'success' | 'danger' | 'default';

  return (
    <Card hover padding="none" className="cursor-pointer" onClick={() => onClick?.(lead)}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-main truncate">{lead.name}</h3>
            {lead.business_name && lead.business_name !== lead.name && (
              <p className="text-sm text-text-muted truncate">{lead.business_name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2 flex-shrink-0">
            {lead.score && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                <span className="text-sm font-bold text-amber-600">{lead.score}</span>
              </div>
            )}
            <Badge variant={variant}>
              {LEAD_STATUS_LABELS[lead.status as LeadStatus] || lead.status}
            </Badge>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          {lead.profession && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Briefcase className="h-3.5 w-3.5" />
              <span>{lead.profession}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <Phone className="h-3.5 w-3.5" />
            <span>{formatPhone(lead.phone)}</span>
            {lead.dncl_listed && (
              <Badge variant="danger">LNNTE</Badge>
            )}
          </div>
          {lead.city && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <MapPin className="h-3.5 w-3.5" />
              <span>{lead.city}</span>
            </div>
          )}
        </div>

        {lead.score_reason && (
          <p className="text-xs text-text-light mb-3 line-clamp-2">{lead.score_reason}</p>
        )}

        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {showClaim && !lead.claimed_by && (
            <Button size="sm" variant="primary" icon={<UserPlus className="h-4 w-4" />} onClick={() => onClaim?.(lead)}>
              Prendre
            </Button>
          )}
          {lead.claimed_by && onCall && (
            <Button size="sm" variant="outline" icon={<Phone className="h-4 w-4" />} onClick={() => onCall?.(lead)}>
              Appeler
            </Button>
          )}
          {lead.claimed_by && (
            <Button size="sm" variant="ghost" icon={<MessageSquare className="h-4 w-4" />} onClick={() => onClick?.(lead)}>
              Notes
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
