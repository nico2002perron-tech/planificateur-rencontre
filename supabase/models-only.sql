-- ============================================
-- Tables pour la section Modeles SEULEMENT
-- A rouler si les tables de base (users, clients, etc.) existent deja
-- ============================================

-- Fonction updated_at (si elle n'existe pas deja)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Extension UUID
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PRICE_CACHE (si manquant)
-- ============================================
CREATE TABLE IF NOT EXISTS price_cache (
  symbol TEXT PRIMARY KEY,
  price NUMERIC(18,4),
  change_percent NUMERIC(8,4),
  market_cap NUMERIC(20,0),
  pe_ratio NUMERIC(10,2),
  dividend_yield NUMERIC(8,4),
  fifty_two_week_high NUMERIC(18,4),
  fifty_two_week_low NUMERIC(18,4),
  company_name TEXT,
  sector TEXT,
  industry TEXT,
  exchange TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MODEL_PORTFOLIOS (portefeuilles modeles sauvegardes)
-- ============================================
CREATE TABLE IF NOT EXISTS model_portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  risk_level TEXT CHECK (risk_level IN ('CONSERVATEUR', 'MODERE', 'EQUILIBRE', 'CROISSANCE', 'DYNAMIQUE')),
  holdings JSONB NOT NULL DEFAULT '[]',
  created_by UUID,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INVESTMENT_PROFILES (les 6 profils de risque)
-- ============================================
CREATE TABLE IF NOT EXISTS investment_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  profile_number INTEGER UNIQUE NOT NULL,
  equity_pct NUMERIC(5,2) NOT NULL,
  bond_pct NUMERIC(5,2) NOT NULL,
  nb_bonds INTEGER NOT NULL DEFAULT 15,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed les 6 profils (ignore si deja presents)
INSERT INTO investment_profiles (name, slug, profile_number, equity_pct, bond_pct, nb_bonds, sort_order)
VALUES
  ('Prudent',                'prudent',               1, 40, 60, 25, 1),
  ('Conservateur',           'conservateur',           2, 50, 50, 22, 2),
  ('Equilibre Conservateur', 'equilibre-conservateur', 3, 60, 40, 18, 3),
  ('Equilibre Croissance',   'equilibre-croissance',   4, 70, 30, 15, 4),
  ('Croissance',             'croissance',             5, 80, 20, 12, 5),
  ('Croissance Maximum',     'croissance-maximum',     6, 90, 10,  8, 6)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- MODEL_SECTOR_CONFIG (poids sectoriels par profil)
-- ============================================
CREATE TABLE IF NOT EXISTS model_sector_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES investment_profiles(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  weight_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  nb_titles INTEGER NOT NULL DEFAULT 3,
  UNIQUE(profile_id, sector)
);

CREATE INDEX IF NOT EXISTS idx_model_sector_config_profile ON model_sector_config(profile_id);

-- ============================================
-- MODEL_STOCK_UNIVERSE (titres disponibles par secteur)
-- ============================================
CREATE TABLE IF NOT EXISTS model_stock_universe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  stock_type TEXT NOT NULL DEFAULT 'variable' CHECK (stock_type IN ('obligatoire', 'variable')),
  position INTEGER NOT NULL DEFAULT 99,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(symbol, sector)
);

CREATE INDEX IF NOT EXISTS idx_stock_universe_sector ON model_stock_universe(sector, position);

-- ============================================
-- BONDS_UNIVERSE (obligations disponibles)
-- ============================================
CREATE TABLE IF NOT EXISTS bonds_universe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  description TEXT NOT NULL,
  issuer TEXT,
  cusip TEXT,
  coupon NUMERIC(8,4),
  maturity DATE,
  price NUMERIC(10,4),
  yield NUMERIC(8,4),
  spread NUMERIC(8,2),
  category TEXT,
  source TEXT CHECK (source IN ('CAD', 'US', 'MANUAL')),
  rating_sp TEXT,
  rating_dbrs TEXT,
  is_mandatory BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonds_universe_coupon_maturity ON bonds_universe(coupon, maturity);

-- ============================================
-- MODEL_BOND_CONFIG (config obligations par profil)
-- ============================================
CREATE TABLE IF NOT EXISTS model_bond_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES investment_profiles(id) ON DELETE CASCADE,
  price_min NUMERIC(10,2) DEFAULT 0,
  price_max NUMERIC(10,2) DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MODEL_GENERATED (historique des portefeuilles generes)
-- ============================================
CREATE TABLE IF NOT EXISTS model_generated (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES investment_profiles(id) ON DELETE SET NULL,
  model_id UUID REFERENCES model_portfolios(id) ON DELETE SET NULL,
  client_id UUID,
  total_value NUMERIC(18,2) NOT NULL,
  equity_value NUMERIC(18,2),
  bond_value NUMERIC(18,2),
  remainder NUMERIC(18,2),
  holdings_snapshot JSONB NOT NULL DEFAULT '[]',
  bonds_snapshot JSONB NOT NULL DEFAULT '[]',
  stats JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_generated_profile ON model_generated(profile_id);

-- ============================================
-- Triggers updated_at
-- ============================================
DO $$ BEGIN
  CREATE TRIGGER investment_profiles_updated_at BEFORE UPDATE ON investment_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER stock_universe_updated_at BEFORE UPDATE ON model_stock_universe FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER bonds_universe_updated_at BEFORE UPDATE ON bonds_universe FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER bond_config_updated_at BEFORE UPDATE ON model_bond_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER model_portfolios_updated_at BEFORE UPDATE ON model_portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
