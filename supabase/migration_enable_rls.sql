-- ============================================================================
-- Sécurité : activer Row Level Security (RLS) sur TOUTES les tables publiques
-- ============================================================================
-- Pourquoi : l'API REST de Supabase (PostgREST) expose le schéma `public` et
-- accepte la clé `anon` (publique). Sans RLS, n'importe qui détenant la clé anon
-- peut lire/écrire les tables directement, en contournant l'application.
--
-- Pourquoi c'est sans risque ici : l'app n'accède JAMAIS à la base avec la clé
-- anon — tout passe côté serveur avec la clé `service_role`, qui CONTOURNE le
-- RLS. Activer RLS sans politique = « tout refuser » pour la clé anon, sans rien
-- changer pour l'application.
--
-- À exécuter dans le SQL editor de Supabase. Idempotent (réexécutable sans risque).
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    RAISE NOTICE 'RLS activé sur public.%', r.tablename;
  END LOOP;
END $$;

-- ── Vérification ────────────────────────────────────────────────────────────
-- Cette requête doit retourner ZÉRO ligne après l'exécution ci-dessus.
-- (Toute ligne retournée = table encore sans RLS.)
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;
