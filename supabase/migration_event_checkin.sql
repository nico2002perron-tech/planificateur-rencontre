-- Migration : prise des présences (check-in) le jour de l'événement
-- À exécuter dans le SQL Editor de Supabase.
-- Ajoute un horodatage de check-in aux inscriptions individuelles et aux membres d'équipes.

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE event_team_members
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN event_registrations.checked_in_at IS 'Heure d''arrivée (présence) le jour de l''événement — NULL = pas encore arrivé';
COMMENT ON COLUMN event_team_members.checked_in_at IS 'Heure d''arrivée (présence) le jour de l''événement — NULL = pas encore arrivé';
