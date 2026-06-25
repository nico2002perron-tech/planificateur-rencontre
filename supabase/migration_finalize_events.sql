-- =====================================================================
-- FINALISATION ÉVÉNEMENTS — à coller dans le SQL Editor de Supabase
-- (prod : pbrergmetslmavqtmipx). 100 % idempotent : sûr à relancer.
--
-- Regroupe toutes les colonnes des features d'événements (ADD COLUMN IF
-- NOT EXISTS — sans effet si déjà présentes) pour garantir que le schéma
-- est complet, + le correctif du courriel de notif organisateur, + un
-- audit final qui liste chaque colonne attendue (✅/❌).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Composition d'équipe par genre  (NOUVEAU — probablement manquant)
-- ---------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS team_gender_composition JSONB DEFAULT NULL;
COMMENT ON COLUMN events.team_gender_composition IS
  'Composition d''équipe par genre : { enabled, male_spots, female_spots }. null = aucune règle de genre.';

ALTER TABLE event_team_members
  ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
COMMENT ON COLUMN event_team_members.gender IS
  'Genre du membre pour la composition d''équipe : ''M'' (gars), ''F'' (filles), ou '''' si non spécifié.';

-- ---------------------------------------------------------------------
-- 2) Photos des règlements (tournois)  (NOUVEAU — probablement manquant)
-- ---------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS rules_images JSONB DEFAULT '[]';
COMMENT ON COLUMN events.rules_images IS
  'Photos des règlements (tableau d''URLs) affichées dans la section « Règlements » de la page publique.';

-- ---------------------------------------------------------------------
-- 3) Carte d'invitation personnalisable (filet de sécurité — déjà fait ?)
-- ---------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tagline        TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS highlights     JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS program        JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS accent_color   TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS cta_label      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS show_countdown BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured       BOOLEAN DEFAULT false;

-- ---------------------------------------------------------------------
-- 4) Date limite commande de chandails  (filet de sécurité)
-- ---------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS shirt_order_deadline DATE;

-- ---------------------------------------------------------------------
-- 5) Rappels courriel — config + anti-doublon  (filet de sécurité)
-- ---------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_dates       JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminders_sent       JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_14d_sent_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS reminder_7d_sent_at  TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 6) Check-in jour J  (filet de sécurité — confirmé fait le 2026-06-12)
-- ---------------------------------------------------------------------
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE event_team_members  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 7) Correctif : les notifications d'inscription partaient vers le
--    placeholder admin@gfsf.ca (inexistant) -> rebond. On bascule le
--    compte admin vers le vrai courriel. (email est UNIQUE : on ne
--    touche à rien si la cible existe déjà, pour éviter un conflit.)
--    Le mot de passe (login admin) reste inchangé ; seul le courriel
--    de connexion devient nico2002.perron@gmail.com.
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM users WHERE email = 'nico2002.perron@gmail.com') THEN
    RAISE NOTICE 'Cible nico2002.perron@gmail.com déjà présente — aucun changement d''email.';
  ELSIF EXISTS (SELECT 1 FROM users WHERE email = 'admin@gfsf.ca') THEN
    UPDATE users
      SET email = 'nico2002.perron@gmail.com', updated_at = NOW()
      WHERE email = 'admin@gfsf.ca';
    RAISE NOTICE 'Courriel admin mis à jour : admin@gfsf.ca -> nico2002.perron@gmail.com (mdp inchangé).';
  ELSE
    RAISE NOTICE 'Aucun compte admin@gfsf.ca trouvé — rien à changer.';
  END IF;
END $$;

-- =====================================================================
-- AUDIT — chaque colonne attendue, présente (✅) ou manquante (❌)
-- =====================================================================
WITH expected(table_name, column_name) AS (
  VALUES
    ('events','team_gender_composition'), ('event_team_members','gender'),
    ('events','rules_images'),
    ('events','tagline'), ('events','highlights'), ('events','program'),
    ('events','accent_color'), ('events','cta_label'),
    ('events','show_countdown'), ('events','featured'),
    ('events','shirt_order_deadline'),
    ('events','reminder_dates'), ('events','reminders_sent'),
    ('events','reminder_14d_sent_at'), ('events','reminder_7d_sent_at'),
    ('event_registrations','checked_in_at'), ('event_team_members','checked_in_at')
)
SELECT
  e.table_name,
  e.column_name,
  CASE WHEN c.column_name IS NULL THEN '❌ MANQUANTE' ELSE '✅ ok' END AS etat
FROM expected e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = e.table_name
 AND c.column_name  = e.column_name
ORDER BY etat, e.table_name, e.column_name;

-- Compte admin après correctif
SELECT id, email, role, status FROM users WHERE role = 'admin' ORDER BY created_at;
