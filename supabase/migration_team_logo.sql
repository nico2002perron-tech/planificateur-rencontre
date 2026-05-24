-- ============================================
-- Migration: Logo d'équipe (modalité configurable)
-- À exécuter dans le SQL Editor de Supabase.
-- ============================================

-- URL du logo téléversé par le capitaine (optionnel)
ALTER TABLE event_teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Modalité par événement : autoriser (ou non) un logo d'équipe
ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_team_logo BOOLEAN NOT NULL DEFAULT false;
