-- ============================================================================
-- BudgetApp — Supabase PostgreSQL Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS PROFILE TABLE
-- Extends Supabase's built-in auth.users with app-specific profile data.
-- A row is auto-inserted by a trigger when a user signs up.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  full_name         TEXT,
  avatar_url        TEXT,
  -- International student settings
  home_currency     TEXT DEFAULT 'USD',   -- ISO 4217 code (e.g. 'INR', 'NGN', 'CNY')
  is_international  BOOLEAN DEFAULT FALSE,
  university        TEXT,
  student_type      TEXT CHECK (student_type IN ('undergraduate', 'graduate', 'phd', 'other')),
  -- Notification preferences (stored as JSONB for flexibility)
  notification_prefs JSONB DEFAULT '{"email": true, "budget_alerts": true, "subscription_alerts": true}'::jsonb,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- CATEGORIES TABLE
-- Both system-provided categories and user-defined custom categories.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL = system category
  name        TEXT NOT NULL,
  icon        TEXT,           -- emoji or icon name (e.g. '🍔', 'food')
  color       TEXT,           -- hex color for charts (e.g. '#6366f1')
  is_system   BOOLEAN DEFAULT FALSE,  -- true = cannot be deleted by user
  -- Niche category types for targeted features
  category_type TEXT CHECK (category_type IN (
    'food', 'transport', 'housing', 'education', 'health', 'fitness',
    'entertainment', 'subscriptions', 'shopping', 'travel', 'income',
    'savings', 'utilities', 'personal_care', 'other'
  )),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed system categories
INSERT INTO public.categories (name, icon, color, is_system, category_type) VALUES
  ('Food & Dining',       '🍔', '#f97316', TRUE, 'food'),
  ('Transport',           '🚗', '#3b82f6', TRUE, 'transport'),
  ('Housing & Rent',      '🏠', '#8b5cf6', TRUE, 'housing'),
  ('Education & Tuition', '🎓', '#06b6d4', TRUE, 'education'),
  ('Health & Medical',    '💊', '#ef4444', TRUE, 'health'),
  ('Fitness & Gym',       '💪', '#22c55e', TRUE, 'fitness'),
  ('Entertainment',       '🎬', '#ec4899', TRUE, 'entertainment'),
  ('Subscriptions',       '📱', '#6366f1', TRUE, 'subscriptions'),
  ('Shopping',            '🛍️', '#f59e0b', TRUE, 'shopping'),
  ('Travel',              '✈️', '#14b8a6', TRUE, 'travel'),
  ('Income',              '💰', '#10b981', TRUE, 'income'),
  ('Savings',             '🏦', '#64748b', TRUE, 'savings'),
  ('Utilities',           '💡', '#a78bfa', TRUE, 'utilities'),
  ('Personal Care',       '🧴', '#fb7185', TRUE, 'personal_care'),
  ('Other',               '📦', '#94a3b8', TRUE, 'other');

-- ─────────────────────────────────────────────────────────────────────────────
-- PLAID ITEMS TABLE
-- Each "item" represents one bank connection (one institution login).
-- A user can have multiple items (multiple banks).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.plaid_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SECURITY: access_token is highly sensitive — encrypt at rest in production
  access_token      TEXT NOT NULL,
  item_id           TEXT NOT NULL UNIQUE,   -- Plaid's item ID
  institution_id    TEXT,
  institution_name  TEXT,
  -- Cursor tracks where we left off for incremental transaction sync
  transaction_cursor TEXT,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'disconnected')),
  error_code        TEXT,  -- populated when status = 'error'
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BANK ACCOUNTS TABLE
-- Individual accounts within a Plaid item (checking, savings, credit, etc.)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.bank_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_item_id   UUID NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL UNIQUE,  -- Plaid's account_id
  name            TEXT NOT NULL,          -- e.g. "Chase Checking ••4242"
  official_name   TEXT,
  type            TEXT,   -- depository | credit | loan | investment
  subtype         TEXT,   -- checking | savings | credit card | etc.
  currency        TEXT DEFAULT 'USD',
  -- Balances (updated on each sync)
  balance_available DECIMAL(12,2),
  balance_current   DECIMAL(12,2),
  balance_limit     DECIMAL(12,2),  -- for credit cards
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRANSACTIONS TABLE
-- Core table — stores every transaction fetched from Plaid.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.transactions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id     UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  plaid_transaction_id TEXT UNIQUE,  -- Plaid's transaction_id for deduplication
  -- Core transaction data
  amount              DECIMAL(12,2) NOT NULL,  -- positive = debit (money out), negative = credit (money in)
  currency            TEXT DEFAULT 'USD',
  -- For international students: converted amount in home currency
  amount_home_currency DECIMAL(12,2),
  home_currency       TEXT,
  exchange_rate_used  DECIMAL(10,6),
  -- Merchant / description
  name                TEXT NOT NULL,    -- transaction name / merchant name
  merchant_name       TEXT,             -- cleaned merchant name from Plaid
  logo_url            TEXT,             -- merchant logo from Plaid
  -- Dates
  date                DATE NOT NULL,    -- transaction date
  authorized_date     DATE,
  -- Categorization
  category_id         UUID REFERENCES public.categories(id),
  plaid_category      TEXT[],           -- original Plaid category array
  plaid_category_id   TEXT,
  user_overrode_category BOOLEAN DEFAULT FALSE,  -- true if user manually set category
  -- Status flags
  pending             BOOLEAN DEFAULT FALSE,
  is_recurring        BOOLEAN DEFAULT FALSE,  -- detected subscription/recurring charge
  notes               TEXT,           -- user can add notes to transactions
  -- Raw Plaid data preserved for debugging
  plaid_raw           JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by user + date range (most common query pattern)
CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category  ON public.transactions(category_id);
CREATE INDEX idx_transactions_recurring ON public.transactions(user_id, is_recurring);

-- ─────────────────────────────────────────────────────────────────────────────
-- BUDGETS TABLE
-- Monthly spending limits per category.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.budgets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  -- Budget period: year + month (e.g. 2024, 3 = March 2024)
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount      DECIMAL(12,2) NOT NULL,   -- budget limit
  currency    TEXT DEFAULT 'USD',
  alert_at_percent INTEGER DEFAULT 80,  -- send alert when spending reaches X% of budget
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  -- One budget per category per month
  UNIQUE(user_id, category_id, year, month)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS TABLE
-- Detected or manually added recurring subscriptions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,        -- e.g. "Netflix", "Spotify", "Planet Fitness"
  merchant_name     TEXT,
  amount            DECIMAL(12,2) NOT NULL,
  currency          TEXT DEFAULT 'USD',
  frequency         TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'annual')),
  category_id       UUID REFERENCES public.categories(id),
  -- Billing cycle tracking
  next_billing_date DATE,
  last_billed_date  DATE,
  -- Detection metadata
  is_auto_detected  BOOLEAN DEFAULT FALSE, -- true if we detected it from transactions
  detection_confidence DECIMAL(3,2),       -- 0.0–1.0 confidence score
  -- Status
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
  notes             TEXT,
  logo_url          TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Users can only read/write their own data. This is enforced at DB level.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see/edit their own profile
CREATE POLICY "profiles: own row" ON public.profiles
  FOR ALL USING (auth.uid() = id);

-- Categories: users see system categories (user_id IS NULL) + their own
CREATE POLICY "categories: system + own" ON public.categories
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "categories: insert own" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories: update own" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id AND is_system = FALSE);
CREATE POLICY "categories: delete own" ON public.categories
  FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- Plaid items, bank accounts, transactions, budgets, subscriptions: own rows only
CREATE POLICY "plaid_items: own"   ON public.plaid_items   FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "bank_accounts: own" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "transactions: own"  ON public.transactions  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "budgets: own"       ON public.budgets       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "subscriptions: own" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- USEFUL VIEWS
-- ─────────────────────────────────────────────────────────────────────────────

-- Spending by category for current month (used by dashboard pie chart)
CREATE OR REPLACE VIEW public.v_spending_by_category AS
SELECT
  t.user_id,
  c.id   AS category_id,
  c.name AS category_name,
  c.icon,
  c.color,
  c.category_type,
  EXTRACT(YEAR  FROM t.date)::INTEGER AS year,
  EXTRACT(MONTH FROM t.date)::INTEGER AS month,
  SUM(t.amount)::DECIMAL(12,2) AS total_spent,
  COUNT(*)                     AS transaction_count
FROM public.transactions t
LEFT JOIN public.categories c ON c.id = t.category_id
WHERE t.pending = FALSE
  AND t.amount  > 0   -- debits only (money going out)
GROUP BY t.user_id, c.id, c.name, c.icon, c.color, c.category_type,
         EXTRACT(YEAR FROM t.date), EXTRACT(MONTH FROM t.date);

-- Budget vs actual for current month
CREATE OR REPLACE VIEW public.v_budget_vs_actual AS
SELECT
  b.user_id,
  b.category_id,
  c.name   AS category_name,
  c.icon,
  c.color,
  b.year,
  b.month,
  b.amount AS budget_amount,
  COALESCE(s.total_spent, 0) AS spent,
  b.amount - COALESCE(s.total_spent, 0) AS remaining,
  ROUND((COALESCE(s.total_spent, 0) / NULLIF(b.amount, 0)) * 100, 1) AS percent_used
FROM public.budgets b
JOIN public.categories c ON c.id = b.category_id
LEFT JOIN public.v_spending_by_category s
  ON s.category_id = b.category_id
 AND s.user_id     = b.user_id
 AND s.year        = b.year
 AND s.month       = b.month;
