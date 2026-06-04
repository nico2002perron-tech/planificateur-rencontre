-- ============================================================================
-- Résolution des cours cibles — résultats datés + suivi du sommet/creux
-- ============================================================================
-- Chaque cible montrée à un client est une prédiction datée (price_target_snapshots).
-- Ce migration ajoute de quoi MESURER ces prédictions :
--
--   • Résultat à l'échéance (rempli par le cron /api/cron/resolve-targets quand
--     l'horizon est atteint) :
--       resolved_at     — date de résolution
--       actual_price    — prix de clôture à l'échéance
--       actual_gain_pct — gain réalisé depuis le prix d'alors (%)
--       hit             — la cible a-t-elle été ATTEINTE (touchée) pendant l'horizon
--
--   • Suivi continu (mis à jour quotidiennement par le même cron, tant que la
--     prédiction n'est pas résolue) — sert à juger « touché ou non » honnêtement,
--     sans pénaliser une cible atteinte puis retombée :
--       peak_price / peak_at     — plus haut atteint depuis la prédiction
--       trough_price / trough_at — plus bas atteint depuis la prédiction
--
-- Le cron tourne SANS la phrase de passe du coffre : il ne touche jamais aux noms
-- (name_enc / name_idx), uniquement aux symboles et aux prix. Aucun déchiffrement
-- requis côté serveur.
--
-- À exécuter une seule fois dans le SQL editor de Supabase. Idempotent.
-- ============================================================================

-- Résultat à l'échéance
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS resolved_at     DATE;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS actual_price    NUMERIC;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS actual_gain_pct NUMERIC;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS hit             BOOLEAN;

-- Suivi du sommet / creux pendant l'horizon
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS peak_price   NUMERIC;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS peak_at      DATE;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS trough_price NUMERIC;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS trough_at    DATE;

-- Le cron balaie les prédictions non encore résolues : index partiel ciblé.
CREATE INDEX IF NOT EXISTS idx_pts_unresolved
  ON price_target_snapshots (predicted_at)
  WHERE resolved_at IS NULL;
