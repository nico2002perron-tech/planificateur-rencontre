-- Migration : composition d'équipe par genre (gars / filles)
-- À exécuter dans le SQL Editor de Supabase.
--
-- Permet de définir, à la création d'un événement d'équipe, un nombre de places
-- FIXE par genre (ex. 8 gars + 2 filles = équipe de 10). La page publique affiche
-- alors un bouton « Ajouter une personne » avec des compteurs de places par genre
-- (bleu = gars, rose = filles) et bloque dès qu'un genre est complet.

-- 1) Règle de composition stockée sur l'événement (null = pas de règle de genre).
--    Format : { "enabled": true, "male_spots": 8, "female_spots": 2 }
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS team_gender_composition JSONB DEFAULT NULL;

COMMENT ON COLUMN events.team_gender_composition IS
  'Composition d''équipe par genre : { enabled, male_spots, female_spots }. null = aucune règle de genre.';

-- 2) Genre de chaque membre d'équipe (''/null pour les inscriptions antérieures).
--    'M' = gars, 'F' = filles.
ALTER TABLE event_team_members
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';

COMMENT ON COLUMN event_team_members.gender IS
  'Genre du membre pour la composition d''équipe : ''M'' (gars), ''F'' (filles), ou '''' si non spécifié.';
