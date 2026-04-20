-- ============================================
-- Planificateur de Rencontre - Groupe Financier Ste-Foy
-- Schéma PostgreSQL pour Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS (conseillers / admins)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'advisor' CHECK (role IN ('admin', 'advisor')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  title TEXT,
  license_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. CLIENTS (prospects / clients)
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type TEXT NOT NULL DEFAULT 'prospect' CHECK (type IN ('prospect', 'client')),
  risk_profile TEXT DEFAULT 'EQUILIBRE' CHECK (risk_profile IN ('CONSERVATEUR', 'MODERE', 'EQUILIBRE', 'CROISSANCE', 'DYNAMIQUE')),
  objectives TEXT,
  investment_horizon TEXT,
  next_meeting_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_advisor ON clients(advisor_id);

-- ============================================
-- 3. PORTFOLIOS
-- ============================================
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'REER' CHECK (account_type IN ('REER', 'CELI', 'REEE', 'NON_ENREGISTRE', 'FERR', 'CRI', 'FRV', 'REER_COLLECTIF')),
  currency TEXT NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD')),
  benchmark_symbols TEXT[] DEFAULT ARRAY['^GSPTSE', '^GSPC'],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolios_client ON portfolios(client_id);

-- ============================================
-- 4. HOLDINGS (positions)
-- ============================================
CREATE TABLE holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT,
  quantity NUMERIC(18,6) NOT NULL DEFAULT 0,
  average_cost NUMERIC(18,4) NOT NULL DEFAULT 0,
  asset_class TEXT CHECK (asset_class IN ('EQUITY', 'FIXED_INCOME', 'CASH', 'ALTERNATIVE', 'REAL_ESTATE', 'COMMODITY')),
  sector TEXT,
  region TEXT CHECK (region IN ('CA', 'US', 'INTL', 'EM')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_holdings_portfolio ON holdings(portfolio_id);
CREATE INDEX idx_holdings_symbol ON holdings(symbol);

-- ============================================
-- 5. BENCHMARKS
-- ============================================
CREATE TABLE benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default benchmarks
INSERT INTO benchmarks (symbol, name, region, description) VALUES
  ('^GSPTSE', 'S&P/TSX Composite', 'CA', 'Indice principal du marché canadien'),
  ('^GSPC', 'S&P 500', 'US', 'Indice des 500 plus grandes entreprises américaines'),
  ('URTH', 'MSCI World ETF', 'INTL', 'ETF répliquant l''indice MSCI World'),
  ('XBB.TO', 'iShares Core Canadian Universe Bond', 'CA', 'ETF obligataire canadien'),
  ('^IXIC', 'NASDAQ Composite', 'US', 'Indice technologique américain'),
  ('XIU.TO', 'iShares S&P/TSX 60', 'CA', 'ETF des 60 plus grandes entreprises canadiennes');

-- ============================================
-- 6. PRICE_CACHE (cache des prix courants)
-- ============================================
CREATE TABLE price_cache (
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
-- 7. HISTORICAL_PRICES
-- ============================================
CREATE TABLE historical_prices (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  date DATE NOT NULL,
  open NUMERIC(18,4),
  high NUMERIC(18,4),
  low NUMERIC(18,4),
  close NUMERIC(18,4) NOT NULL,
  volume BIGINT,
  UNIQUE(symbol, date)
);

CREATE INDEX idx_historical_symbol_date ON historical_prices(symbol, date DESC);

-- ============================================
-- 8. MODEL_PORTFOLIOS (portefeuilles modèles)
-- ============================================
CREATE TABLE model_portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  risk_level TEXT CHECK (risk_level IN ('CONSERVATEUR', 'MODERE', 'EQUILIBRE', 'CROISSANCE', 'DYNAMIQUE')),
  holdings JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 9. REPORTS
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  advisor_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  config JSONB DEFAULT '{}',
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'ready', 'error')),
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_advisor ON reports(advisor_id);

-- ============================================
-- 10. SCENARIOS
-- ============================================
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bull', 'base', 'bear', 'stress')),
  assumptions JSONB NOT NULL DEFAULT '{}',
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scenarios_portfolio ON scenarios(portfolio_id);

-- ============================================
-- 11. EXCHANGE_RATES
-- ============================================
CREATE TABLE exchange_rates (
  pair TEXT PRIMARY KEY,
  rate NUMERIC(12,6) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed CAD/USD
INSERT INTO exchange_rates (pair, rate) VALUES ('CAD/USD', 0.74), ('USD/CAD', 1.35);

-- ============================================
-- 12. AI_CONTENT_CACHE (cache IA Groq 24h)
-- ============================================
CREATE TABLE ai_content_cache (
  id BIGSERIAL PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  data_hash TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portfolio_id, data_hash)
);

CREATE INDEX idx_ai_cache_portfolio ON ai_content_cache(portfolio_id);
CREATE INDEX idx_ai_cache_created ON ai_content_cache(created_at DESC);

-- ============================================
-- 13. AUDIT_LOG
-- ============================================
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER portfolios_updated_at BEFORE UPDATE ON portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER holdings_updated_at BEFORE UPDATE ON holdings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER model_portfolios_updated_at BEFORE UPDATE ON model_portfolios FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 14. FUND_DOCUMENTS (rapports de fonds uploadés)
-- ============================================
CREATE TABLE fund_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_code TEXT NOT NULL,
  fund_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_fund_documents_code ON fund_documents(fund_code);
CREATE INDEX idx_fund_documents_updated ON fund_documents(updated_at DESC);

CREATE TRIGGER fund_documents_updated_at BEFORE UPDATE ON fund_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 15. INVESTMENT_PROFILES (profils d'investissement prédéfinis)
-- Remplace la section 1 de l'onglet Config Excel
-- ============================================
CREATE TABLE investment_profiles (
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
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed les 6 profils du Portefeuille Modèle IG
INSERT INTO investment_profiles (name, slug, profile_number, equity_pct, bond_pct, nb_bonds, sort_order) VALUES
  ('Prudent',                'prudent',               1, 40, 60, 25, 1),
  ('Conservateur',           'conservateur',           2, 50, 50, 22, 2),
  ('Equilibre Conservateur', 'equilibre-conservateur', 3, 60, 40, 18, 3),
  ('Equilibre Croissance',   'equilibre-croissance',   4, 70, 30, 15, 4),
  ('Croissance',             'croissance',             5, 80, 20, 12, 5),
  ('Croissance Maximum',     'croissance-maximum',     6, 90, 10,  8, 6);

CREATE TRIGGER investment_profiles_updated_at BEFORE UPDATE ON investment_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 16. MODEL_SECTOR_CONFIG (poids et nb titres par secteur par profil)
-- Remplace les sections 2 et 3 de l'onglet Config Excel
-- ============================================
CREATE TABLE model_sector_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES investment_profiles(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,
  weight_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  nb_titles INTEGER NOT NULL DEFAULT 3,
  UNIQUE(profile_id, sector)
);

CREATE INDEX idx_model_sector_config_profile ON model_sector_config(profile_id);

-- ============================================
-- 17. MODEL_STOCK_UNIVERSE (univers de titres par secteur)
-- Remplace la feuille "Stocks et RUN" d'Excel
-- ============================================
CREATE TABLE model_stock_universe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT NOT NULL,
  stock_type TEXT NOT NULL DEFAULT 'variable' CHECK (stock_type IN ('obligatoire', 'variable')),
  position INTEGER NOT NULL DEFAULT 99,
  logo_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(symbol, sector)
);

CREATE INDEX idx_stock_universe_sector ON model_stock_universe(sector, position);

CREATE TRIGGER stock_universe_updated_at BEFORE UPDATE ON model_stock_universe FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 18. BONDS_UNIVERSE (univers d'obligations)
-- Remplace les fichiers Bonds CAD.xlsm et Bonds US.xlsm
-- ============================================
CREATE TABLE bonds_universe (
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
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bonds_universe_coupon_maturity ON bonds_universe(coupon, maturity);
CREATE INDEX idx_bonds_universe_category ON bonds_universe(category);

CREATE TRIGGER bonds_universe_updated_at BEFORE UPDATE ON bonds_universe FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 19. MODEL_BOND_CONFIG (filtres et bonds obligatoires par profil)
-- Remplace la section 4 de l'onglet Config Excel
-- ============================================
CREATE TABLE model_bond_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES investment_profiles(id) ON DELETE CASCADE,
  price_min NUMERIC(10,2) DEFAULT 0,
  price_max NUMERIC(10,2) DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER bond_config_updated_at BEFORE UPDATE ON model_bond_config FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 20. MODEL_GENERATED (historique des portefeuilles modèles générés)
-- ============================================
CREATE TABLE model_generated (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES investment_profiles(id) ON DELETE SET NULL,
  model_id UUID REFERENCES model_portfolios(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  total_value NUMERIC(18,2) NOT NULL,
  equity_value NUMERIC(18,2),
  bond_value NUMERIC(18,2),
  remainder NUMERIC(18,2),
  holdings_snapshot JSONB NOT NULL DEFAULT '[]',
  bonds_snapshot JSONB NOT NULL DEFAULT '[]',
  stats JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_generated_client ON model_generated(client_id);
CREATE INDEX idx_model_generated_profile ON model_generated(profile_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be configured when Supabase project is created.
-- The app uses service_role key for server-side operations, bypassing RLS.
-- Client-side Supabase access is NOT used — all data goes through Next.js API routes.

-- ============================================
-- 21. MODEL_SIMULATIONS (simulations en temps réel)
-- ============================================
CREATE TABLE model_simulations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES model_portfolios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initial_value NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CAD' CHECK (currency IN ('CAD', 'USD')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  holdings_snapshot JSONB NOT NULL DEFAULT '[]',
  benchmarks TEXT[] DEFAULT ARRAY['^GSPTSE', '^GSPC'],
  benchmark_start_prices JSONB DEFAULT '{}',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_model_simulations_model ON model_simulations(model_id);
CREATE INDEX idx_model_simulations_status ON model_simulations(status);

CREATE TRIGGER model_simulations_updated_at BEFORE UPDATE ON model_simulations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 22. SIMULATION_SNAPSHOTS (NAV quotidien)
-- ============================================
CREATE TABLE simulation_snapshots (
  id BIGSERIAL PRIMARY KEY,
  simulation_id UUID NOT NULL REFERENCES model_simulations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_value NUMERIC(18,2) NOT NULL,
  daily_return NUMERIC(10,6),
  holdings_detail JSONB NOT NULL DEFAULT '[]',
  benchmark_values JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(simulation_id, date)
);

CREATE INDEX idx_simulation_snapshots_sim ON simulation_snapshots(simulation_id, date DESC);

-- ============================================
-- 23. MEETING_NOTES (notes de réunion client)
-- ============================================
CREATE TABLE meeting_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advisor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  account_number TEXT DEFAULT '',
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meeting_time TEXT DEFAULT '',
  meeting_type TEXT NOT NULL DEFAULT 'in_person' CHECK (meeting_type IN ('phone', 'in_person', 'video')),
  subject TEXT NOT NULL DEFAULT 'revision' CHECK (subject IN ('revision', 'placement', 'both')),
  compliance JSONB NOT NULL DEFAULT '{}',
  transaction JSONB,
  notes JSONB NOT NULL DEFAULT '{}',
  transcription TEXT,
  ai_summary_advisor TEXT,
  ai_summary_client TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meeting_notes_advisor ON meeting_notes(advisor_id);
CREATE INDEX idx_meeting_notes_date ON meeting_notes(meeting_date DESC);

CREATE TRIGGER meeting_notes_updated_at BEFORE UPDATE ON meeting_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
