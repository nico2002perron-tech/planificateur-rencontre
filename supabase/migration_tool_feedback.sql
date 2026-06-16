-- ============================================================================
-- « Nos outils » — signalements de bugs/problèmes envoyés par les utilisateurs
-- des outils financiers du site public (compas.html : Projections, Budget,
-- Calculateur immobilier, Tableau de bord).
-- ============================================================================
-- Le formulaire de signalement (site GFSF) envoie ici en POST anonyme (CORS),
-- sans session. Le service-role côté serveur insère la ligne. Les admins voient
-- tout dans Admin → Nos outils.
--
-- À exécuter une seule fois dans le SQL editor de Supabase. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_feedback (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool        TEXT NOT NULL DEFAULT '',     -- 'compas' | 'budget' | 'hypotheque' | 'dashboard' | ''
  message     TEXT NOT NULL,                -- description du problème
  email       TEXT NOT NULL DEFAULT '',     -- facultatif → vide = signalement anonyme
  page_url    TEXT NOT NULL DEFAULT '',     -- URL d'où vient le signalement
  user_agent  TEXT NOT NULL DEFAULT '',     -- navigateur (diagnostic)
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_feedback_status  ON tool_feedback(status);
CREATE INDEX IF NOT EXISTS idx_tool_feedback_created ON tool_feedback(created_at DESC);
