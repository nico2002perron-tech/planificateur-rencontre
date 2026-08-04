-- ============================================
-- Migration : Tournoi v4 — SPORT du tournoi (dessin du terrain)
-- À exécuter dans le SQL Editor de Supabase.
--
-- Le sport choisi ne sert qu'à DESSINER le bon terrain (losange de balle
-- molle, filet de volleyball, etc.) en tête de l'horaire de chaque terrain,
-- sur les quatre surfaces : console, page publique, mode TV, feuille PDF.
-- Aucune règle de jeu n'en dépend : l'horaire, le classement et les séries
-- fonctionnent exactement pareil quel que soit le sport.
--
-- Sans cette migration, l'application marche quand même : le sport retombe
-- sur « balle molle » et la sauvegarde de la config ignore le champ en le
-- signalant (elle ne plante pas).
--
-- Valeurs : balle-molle | volleyball | pickleball | tennis | basketball
--           | soccer | generique
-- ============================================

ALTER TABLE event_tournaments
  ADD COLUMN IF NOT EXISTS sport TEXT NOT NULL DEFAULT 'balle-molle';

COMMENT ON COLUMN event_tournaments.sport IS 'Sport du tournoi — sert au schéma de terrain affiché (balle-molle, volleyball, pickleball, tennis, basketball, soccer, generique).';
