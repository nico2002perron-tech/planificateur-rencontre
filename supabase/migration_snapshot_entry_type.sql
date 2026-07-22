-- ============================================================================
-- Journal des cibles — distingue les « portefeuilles modèles » des cours cibles
-- ============================================================================
-- Une entrée du journal peut désormais provenir d'un PORTEFEUILLE MODÈLE (proposé
-- à un client, enregistré depuis la page « Comparer ») en plus des cours cibles
-- habituels. Une nouvelle colonne `entry_type` porte cette distinction :
--   'price_target'    -> cours cible normal (défaut, comportement inchangé)
--   'model_portfolio' -> ligne issue d'un portefeuille modèle proposé à un client
--
-- Chaque ligne reste une vraie prédiction par titre (symbole + cible), donc le
-- cron de résolution la suit exactement comme un cours cible. Seul l'AFFICHAGE
-- ajoute un badge « Portefeuille modèle ».
--
-- NOT NULL avec défaut 'price_target' : les lignes existantes deviennent des
-- cours cibles normaux. Aucune contrainte CHECK n'est ajoutée pour éviter d'être
-- couplé à une définition de base non versionnée.
--
-- À exécuter une fois dans le SQL editor de Supabase. Idempotent.
-- ============================================================================

ALTER TABLE price_target_snapshots
  ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'price_target';
