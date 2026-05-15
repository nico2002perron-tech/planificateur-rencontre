export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'meeting' | 'client' | 'lost';

export type LeadSource = 'scrape_pj' | 'scrape_ordre' | 'import_csv' | 'import_excel' | 'manual' | 'referral';

export interface Lead {
  id: string;
  name: string;
  business_name: string | null;
  profession: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string;
  region: string | null;
  source: LeadSource;
  score: number | null;
  score_reason: string | null;
  status: LeadStatus;
  claimed_by: string | null;
  claimed_by_name: string | null;
  dncl_checked: boolean;
  dncl_listed: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  user_name: string;
  type: 'call' | 'note' | 'email' | 'meeting' | 'status_change';
  outcome: string | null;
  notes: string | null;
  ai_summary: string | null;
  next_action: string | null;
  next_action_date: string | null;
  created_at: string;
}

export interface LeadStats {
  total_pool: number;
  total_claimed: number;
  my_leads: number;
  my_calls: number;
  my_meetings: number;
  my_conversions: number;
  conversion_rate: number;
  by_status: Record<LeadStatus, number>;
  by_profession: { profession: string; count: number }[];
}

export interface ScrapeConfig {
  source: 'pagesjaunes' | 'ordre_dentistes' | 'ordre_cpa' | 'ordre_avocats';
  profession: string;
  city: string;
  max_results: number;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contacté',
  qualified: 'Qualifié',
  meeting: 'Rendez-vous',
  client: 'Client',
  lost: 'Perdu',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  new: 'info',
  contacted: 'warning',
  qualified: 'success',
  meeting: 'default',
  client: 'success',
  lost: 'danger',
};

export const PROFESSIONS = [
  'Dentiste',
  'Médecin',
  'Avocat',
  'Notaire',
  'Comptable (CPA)',
  'Ingénieur',
  'Pharmacien',
  'Optométriste',
  'Vétérinaire',
  'Chiropraticien',
  'Architecte',
  'Entrepreneur',
] as const;

export const CITIES_QC = [
  'Québec',
  'Montréal',
  'Laval',
  'Gatineau',
  'Longueuil',
  'Sherbrooke',
  'Lévis',
  'Trois-Rivières',
  'Saguenay',
  'Terrebonne',
  'Saint-Jean-sur-Richelieu',
  'Drummondville',
  'Granby',
  'Rimouski',
] as const;
