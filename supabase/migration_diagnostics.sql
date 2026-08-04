-- Table `diagnostics` : le « flywheel », STRUCTURELLEMENT anonyme.
-- Aucune colonne d'identité, aucune IP — c'est une contrainte de SCHÉMA, pas une
-- politique. L'identité ne vit que dans la future table `analyse_leads`, sur consentement.

create table if not exists diagnostics (
  id uuid primary key default gen_random_uuid(),
  cree_le timestamptz not null default now(),
  positions jsonb not null,                 -- [{code, montant, typeCompte}]
  valeur_totale_tranche text
    check (valeur_totale_tranche in ('<100k', '100-250k', '250-500k', '500k-1M', '>1M')),
  tranche_age text,                          -- optionnelle, jamais obligatoire
  scores jsonb,                              -- {frais, concentration, geographie, global}
  constats jsonb,                            -- constats textuels par axe (analyse qualitative)
  fonds_non_resolus text[],                  -- alimente la file d'enrichissement de `fonds`
  source_utm text                            -- provenance du clic (?src=...), sans identité
);

-- RLS : aucune policy → anon bloqué (le service role bypass la RLS). Insertion et
-- lecture UNIQUEMENT côté serveur via le service role — jamais depuis le navigateur.
alter table diagnostics enable row level security;
