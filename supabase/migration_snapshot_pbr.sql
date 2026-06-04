-- ============================================================================
-- Journal des cibles — ajoute le PBR (prix de base rajusté / prix payé)
-- ============================================================================
-- Le journal montrait : prix au moment de la capture -> prix actuel -> cible.
-- On ajoute le PBR (coût moyen / prix de revient) pour afficher la séquence
-- naturelle « PBR payé -> prix au marché -> cours cible ».
--
-- Nullable, sans défaut : les anciennes captures (sans PBR enregistré) restent
-- NULL et s'affichent « — ». Le PBR se remplit pour les NOUVELLES captures.
--
-- À exécuter une fois dans le SQL editor de Supabase. Idempotent.
-- ============================================================================

ALTER TABLE price_target_snapshots
  ADD COLUMN IF NOT EXISTS average_cost NUMERIC(18,4);
