-- ============================================
-- Migration : Mode tournoi (horaires + pointages + classement)
-- À exécuter dans le SQL Editor de Supabase AVANT de déployer le code.
--
-- event_tournaments : 1 ligne par événement — la configuration du tournoi
--   (parties garanties par équipe, terrains, heure de début, durée, points).
-- event_matches     : les parties générées — le classement n'est JAMAIS stocké,
--   il est recalculé à la volée depuis les parties terminées (source de vérité unique).
-- ============================================

CREATE TABLE IF NOT EXISTS event_tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  guaranteed_games INTEGER NOT NULL DEFAULT 2 CHECK (guaranteed_games BETWEEN 1 AND 5),
  courts INTEGER NOT NULL DEFAULT 2 CHECK (courts BETWEEN 1 AND 8),
  start_time TEXT NOT NULL DEFAULT '09:00',          -- HH:MM heure locale (tournoi d'un jour)
  game_minutes INTEGER NOT NULL DEFAULT 25 CHECK (game_minutes BETWEEN 5 AND 240),
  break_minutes INTEGER NOT NULL DEFAULT 5 CHECK (break_minutes BETWEEN 0 AND 60),
  playoffs_enabled BOOLEAN NOT NULL DEFAULT true,
  playoffs_team_count INTEGER NOT NULL DEFAULT 4 CHECK (playoffs_team_count IN (2, 4, 8)),
  points_win INTEGER NOT NULL DEFAULT 2,
  points_tie INTEGER NOT NULL DEFAULT 1,
  points_loss INTEGER NOT NULL DEFAULT 0,
  -- draft : l'horaire est un brouillon visible de l'organisateur seulement.
  -- published : visible sur la page publique /tournoi/[id].
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  schedule_sent_at TIMESTAMPTZ,                      -- dernier envoi « horaire à tous »
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_tournaments_event ON event_tournaments(event_id);

CREATE TABLE IF NOT EXISTS event_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  -- garantie = parties garanties (phase de classement) ; quart/demi/bronze/finale = éliminatoires
  phase TEXT NOT NULL DEFAULT 'garantie' CHECK (phase IN ('garantie', 'quart', 'demi', 'bronze', 'finale')),
  round_number INTEGER NOT NULL DEFAULT 1,           -- ronde de génération (1, 2, 3…)
  match_number INTEGER NOT NULL,                     -- numéro global affiché : M1, M2, …
  court INTEGER NOT NULL DEFAULT 1,
  scheduled_time TEXT NOT NULL DEFAULT '',           -- HH:MM heure locale, '' = à déterminer
  -- Équipes nullables : un match éliminatoire existe avant de connaître ses équipes.
  -- source_a/source_b décrivent d'où viendra l'équipe (« Gagnant M5 », « 1er au classement »).
  team_a_id UUID REFERENCES event_teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES event_teams(id) ON DELETE SET NULL,
  source_a TEXT NOT NULL DEFAULT '',
  source_b TEXT NOT NULL DEFAULT '',
  score_a INTEGER,
  score_b INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'finished', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, match_number)
);

CREATE INDEX IF NOT EXISTS idx_event_matches_event ON event_matches(event_id);
CREATE INDEX IF NOT EXISTS idx_event_matches_teams ON event_matches(team_a_id, team_b_id);

-- RLS : comme les autres tables événements, tout accès passe par les routes API
-- (clé service role côté serveur) — on bloque l'accès direct anon/authenticated.
ALTER TABLE event_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_matches ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE event_tournaments IS 'Configuration du mode tournoi d''un événement (parties garanties, terrains, horaire).';
COMMENT ON TABLE event_matches IS 'Parties du tournoi. Le classement est calculé à la volée depuis les parties terminées.';
