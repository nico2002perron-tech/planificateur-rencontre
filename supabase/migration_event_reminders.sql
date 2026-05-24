-- ============================================
-- Migration: Rappels courriel d'événement (J-14 / J-7)
-- À exécuter dans le SQL Editor de Supabase.
-- Ajoute le suivi d'envoi pour éviter d'envoyer deux fois le même rappel.
-- ============================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_14d_sent_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_7d_sent_at  TIMESTAMPTZ;
