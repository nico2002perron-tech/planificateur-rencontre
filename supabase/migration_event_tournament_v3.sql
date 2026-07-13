-- ============================================
-- Migration : Tournoi v3 — tournois sur PLUSIEURS JOURS
-- À exécuter dans le SQL Editor de Supabase AVANT de déployer le code v3.
--
-- days : les journées du tournoi avec leurs heures, ex.
--   [{"date":"2026-08-14","start":"18:00","end":"22:00"},
--    {"date":"2026-08-15","start":"09:00","end":"17:00"}]
-- Le générateur remplit les créneaux journée par journée en respectant
-- l'heure de fin de chacune. scheduled_date situe chaque partie sur sa
-- journée ('' = ancienne partie d'avant la v3 → date de l'événement).
-- ============================================

ALTER TABLE event_tournaments
  ADD COLUMN IF NOT EXISTS days JSONB;

ALTER TABLE event_matches
  ADD COLUMN IF NOT EXISTS scheduled_date TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN event_tournaments.days IS 'Journées du tournoi [{date, start, end}] — null = une seule journée (date de l''événement).';
COMMENT ON COLUMN event_matches.scheduled_date IS 'Journée de la partie (YYYY-MM-DD) ; '''' = date de l''événement (parties d''avant la v3).';
