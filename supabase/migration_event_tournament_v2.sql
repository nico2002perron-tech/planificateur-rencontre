-- ============================================
-- Migration : Tournoi v2 — publication contrôlée du site
-- À exécuter dans le SQL Editor de Supabase AVANT de déployer le code v2.
--
-- Le site public n'affiche plus les parties « vivantes » mais une PHOTO
-- (published_snapshot) prise au moment où l'organisateur clique
-- « Mettre à jour le site ». Il peut donc réarranger l'horaire en paix :
-- rien ne change publiquement avant son geste. published_at alimente la
-- note « Dernière mise à jour » de la page publique.
-- ============================================

ALTER TABLE event_tournaments
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS published_snapshot JSONB;

COMMENT ON COLUMN event_tournaments.published_at IS 'Dernier clic « Mettre à jour le site » — affiché aux joueurs.';
COMMENT ON COLUMN event_tournaments.published_snapshot IS 'Photo des parties telle que publiée (le site public lit ceci, jamais les lignes vivantes).';
