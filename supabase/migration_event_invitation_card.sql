-- Migration : carte d'invitation personnalisable (mini-page d'événement)
-- À exécuter dans le SQL Editor de Supabase.
-- Ajoute les champs de personnalisation de la carte/mini-page d'un événement.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tagline TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS highlights JSONB DEFAULT '[]',   -- [{ "icon": "<lucide>", "text": "..." }]
  ADD COLUMN IF NOT EXISTS program JSONB DEFAULT '[]',       -- [{ "time": "18h00", "label": "Cocktail" }]
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '',     -- hex (ex. #0077b6) ; vide = cyan par défaut
  ADD COLUMN IF NOT EXISTS cta_label TEXT DEFAULT '',        -- texte du bouton ; vide = « Je réserve ma place »
  ADD COLUMN IF NOT EXISTS show_countdown BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

COMMENT ON COLUMN events.tagline IS 'Slogan d''accroche affiché sous le titre';
COMMENT ON COLUMN events.highlights IS 'Atouts/inclus : tableau de { icon, text }';
COMMENT ON COLUMN events.program IS 'Programme/horaire : tableau de { time, label }';
COMMENT ON COLUMN events.accent_color IS 'Couleur d''accent (hex) de la carte ; vide = cyan';
COMMENT ON COLUMN events.cta_label IS 'Libellé personnalisé du bouton d''inscription';
COMMENT ON COLUMN events.show_countdown IS 'Afficher le décompte sur la carte et la mini-page';
COMMENT ON COLUMN events.featured IS 'Marquer « À la une » (mise en avant)';
