-- ============================================================================
-- Coffre client — étend le chiffrement aux notes de rencontre
-- ============================================================================
-- Même principe que le Journal : le nom du client et le numéro de compte sont
-- chiffrés DANS le navigateur (AES-256-GCM) avant le stockage. name_idx est
-- l'index aveugle déterministe (recherche/regroupement sans nom en clair).
--
-- À exécuter dans le SQL editor de Supabase. Idempotent.
-- ============================================================================

ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS name_enc TEXT;
ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS name_idx TEXT;
ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS account_enc TEXT;

CREATE INDEX IF NOT EXISTS idx_meeting_notes_advisor_name_idx
  ON meeting_notes (advisor_id, name_idx);

-- RLS deny-all (l'app utilise service_role qui contourne RLS).
ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
