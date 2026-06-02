-- ============================================================================
-- Coffre client (option D) — chiffrement des noms de clients côté navigateur
-- ============================================================================
-- Principe : le vrai nom du client n'est JAMAIS stocké en clair. Le navigateur
-- du conseiller dérive une clé à partir d'une phrase de passe (jamais envoyée
-- au serveur), puis stocke :
--   • name_enc : le nom chiffré en AES-256-GCM (authentifié)
--   • name_idx : un « index aveugle » HMAC déterministe, pour chercher/grouper
--                sans révéler le nom.
-- Une fuite de la base ne donne donc qu'un index opaque + un texte chiffré,
-- indéchiffrables sans la phrase de passe du conseiller.
--
-- À exécuter une seule fois dans le SQL editor de Supabase. Idempotent.
-- ============================================================================

-- 1) Par conseiller : sel de dérivation (non secret) + jeton de vérification
--    (un court texte chiffré qui sert à valider la phrase de passe au
--     déverrouillage, sans stocker la phrase ni la clé).
ALTER TABLE users ADD COLUMN IF NOT EXISTS kdf_salt TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name_verifier TEXT;

-- 2) Sur le journal des cibles : nom chiffré + index aveugle.
--    On garde client_name (legacy) le temps de migrer les anciennes lignes,
--    après quoi il est vidé.
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS name_enc TEXT;
ALTER TABLE price_target_snapshots ADD COLUMN IF NOT EXISTS name_idx TEXT;

-- Recherche/regroupement/dédoublonnage par client se font désormais sur l'index.
CREATE INDEX IF NOT EXISTS idx_pts_advisor_name_idx
  ON price_target_snapshots (advisor_id, name_idx);

-- 3) Durcissement défense-en-profondeur : RLS « deny-all » sur le journal.
--    L'app n'accède à la base que via la clé service_role (côté serveur), qui
--    contourne RLS. Activer RLS sans politique bloque donc tout accès par la
--    clé anon publique — assurance gratuite si la clé anon venait à fuiter.
ALTER TABLE price_target_snapshots ENABLE ROW LEVEL SECURITY;
