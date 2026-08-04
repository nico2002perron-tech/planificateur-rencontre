-- Table `analyse_leads` : leads ENTRANTS, créés UNIQUEMENT sur consentement explicite.
-- Volontairement SÉPARÉE de `leads` (prospection sortante à froid + DNCL) — les deux
-- préoccupations Loi 25 sont opposées et ne doivent jamais se mélanger.

create table if not exists analyse_leads (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid references diagnostics(id) on delete set null,
  cree_le timestamptz not null default now(),
  prenom text not null,
  nom text not null,
  courriel text not null,
  telephone text,
  consentement_transmission boolean not null,
  consentement_texte_version text not null,   -- audit Loi 25 : version du wording accepté
  statut text not null default 'nouveau'
    check (statut in ('nouveau', 'contacte', 'rencontre', 'converti', 'perdu')),
  notes text,
  rencontre_id uuid                            -- pont futur (pas de FK : l'entité rendez-vous = meeting_notes)
);

create index if not exists analyse_leads_statut_idx on analyse_leads (statut);
create index if not exists analyse_leads_cree_le_idx on analyse_leads (cree_le desc);

-- RLS : aucune policy → service role uniquement (création via route serveur, lecture via session admin).
alter table analyse_leads enable row level security;
