-- Migration : photos des règlements d'un événement (tournois)
-- À exécuter dans le SQL Editor de Supabase.
-- Stocke une ou plusieurs photos des règlements, affichées dans une section
-- « Règlements » sur la page publique (cliquables en plein écran).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rules_images JSONB DEFAULT '[]';

COMMENT ON COLUMN events.rules_images IS 'Photos des règlements (tableau d''URLs) affichées dans la section « Règlements » de la page publique.';
