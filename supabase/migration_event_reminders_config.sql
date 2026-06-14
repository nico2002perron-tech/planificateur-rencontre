-- Migration : rappels courriel configurables par l'organisateur
-- À exécuter dans le SQL Editor de Supabase.
-- reminder_dates  : dates de rappel choisies dans le formulaire (array de 'YYYY-MM-DD').
--                   Si vide → le cron retombe sur le défaut J-14 / J-7.
-- reminders_sent  : dates déjà envoyées (anti-doublon), géré par le cron.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reminder_dates JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reminders_sent JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN events.reminder_dates IS 'Dates de rappel courriel configurées (array de YYYY-MM-DD). Vide = défaut J-14 et J-7.';
COMMENT ON COLUMN events.reminders_sent IS 'Dates de rappel déjà envoyées (array de YYYY-MM-DD) — anti-doublon, géré par le cron.';
