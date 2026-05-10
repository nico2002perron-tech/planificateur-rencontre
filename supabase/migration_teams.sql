-- ============================================
-- Migration: Event Teams System
-- Run this in Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS event_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_code TEXT NOT NULL UNIQUE,
  captain_email TEXT NOT NULL,
  manage_token TEXT NOT NULL UNIQUE,
  max_members INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_teams_event ON event_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_event_teams_code ON event_teams(team_code);

CREATE TABLE IF NOT EXISTS event_team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES event_teams(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  skill_level TEXT DEFAULT '',
  shirt_size TEXT DEFAULT '',
  dietary_restrictions TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  is_captain BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_team_members_team ON event_team_members(team_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_team_members_unique_email ON event_team_members(team_id, email) WHERE status = 'confirmed';
