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
-- 12. AUDIT_LOG
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
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies will be configured when Supabase project is created.
-- The app uses service_role key for server-side operations, bypassing RLS.
-- Client-side Supabase access is NOT used — all data goes through Next.js API routes.
