-- Table `fonds` : référentiel propriétaire GFSF.
-- Alimentée À LA MAIN / par CSV (scripts/importer-fonds.mjs) — jamais par une IA.
-- Source primaire du moteur : aucune donnée live fiable pour le RFG/holdings.

create table if not exists fonds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  nom text not null,
  type text not null default 'autre'
    check (type in ('fonds_commun', 'fnb', 'action', 'obligation', 'autre')),
  categorie text not null default '',
  rfg numeric(6, 4) not null,              -- décimal : 0.0225 = 2,25 %
  rfg_median_categorie numeric(6, 4),      -- calculée sur toute la table (voir importeur)
  top_holdings jsonb,                       -- [{titre, poids}] — Sprint 2 (chevauchement)
  allocation_geo jsonb,                     -- {canada: 0.25, usa: 0.45, ...}
  allocation_secteurs jsonb,
  source text not null default 'manuel'
    check (source in ('manuel', 'yahoo', 'apercu_fonds')),
  verifie_le timestamptz,                   -- date de dernière vérification manuelle
  a_enrichir boolean not null default false,-- soumis par un usager mais incomplet
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fonds_categorie_idx on fonds (categorie);
create index if not exists fonds_code_lower_idx on fonds (lower(code));

-- RLS : lecture publique (autocomplete), écriture réservée au service role
-- (lequel bypass la RLS de toute façon — la policy documente l'intention).
alter table fonds enable row level security;
drop policy if exists fonds_lecture_publique on fonds;
create policy fonds_lecture_publique on fonds
  for select to anon, authenticated using (true);
