# Credix — Full-Stack Budgeting App

A fintech-grade budgeting MVP built with **Next.js**, **Supabase**, and **Plaid**.

---

## Features

| Feature | Description |
|---|---|
| Bank sync | Connect real bank accounts via Plaid Link |
| Auto-categorization | Rule-based + optional GPT-4o-mini AI categorization |
| Budget tracking | Set monthly budgets per category, see % used |
| Subscription detection | Automatically detects recurring charges from transactions |
| Currency conversion | International students see amounts in their home currency |
| Spending insights | AI-generated personalized spending tips |
| Student alerts | Warns when tuition, rent, food, or fitness budgets run low |

---

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Plaid](https://dashboard.plaid.com) account (sandbox is free)
- Optional: [OpenAI](https://platform.openai.com) API key for AI features
- Optional: [Open Exchange Rates](https://openexchangerates.org) key for currency conversion

### 2. Clone and install

```bash
cd "Budget app"
npm install
```

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

```env
# Supabase (Dashboard → Project → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Plaid (Dashboard → Team Settings → Keys)
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-sandbox-secret
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions,auth
PLAID_COUNTRY_CODES=US

# OpenAI (optional)
OPENAI_API_KEY=sk-...

# Exchange Rates (optional, for international students)
EXCHANGE_RATES_API_KEY=your-key
```

### 4. Set up Supabase database

1. Go to your Supabase project → **SQL Editor** → **New query**
2. Copy the contents of `supabase/schema.sql`
3. Paste and click **Run**

This creates all tables, views, RLS policies, and seeds the default categories.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
budget-app/
│
├── .env.local.example       # Template for all required env vars
├── package.json
├── next.config.js
├── tailwind.config.js
│
├── supabase/
│   └── schema.sql           # Full DB schema — run once in Supabase SQL editor
│
├── lib/                     # Server/client API clients (never expose secrets)
│   ├── supabase.ts          # Browser + admin Supabase clients
│   ├── plaid.ts             # Plaid API client
│   ├── openai.ts            # OpenAI client + AI helper functions
│   └── currency.ts          # Exchange rate fetching + formatting
│
├── types/
│   └── index.ts             # All TypeScript types (mirrors DB schema)
│
├── utils/
│   ├── categorize.ts        # Rule-based transaction categorizer
│   ├── subscriptions.ts     # Subscription detection algorithm
│   └── formatters.ts        # Currency, date, percent formatters
│
├── hooks/                   # SWR data-fetching hooks
│   ├── useTransactions.ts
│   ├── useBudgets.ts
│   └── useSubscriptions.ts
│
├── context/
│   └── AuthContext.tsx      # Global auth state (useAuth hook)
│
├── components/
│   ├── layout/              # Navbar, Layout wrapper
│   ├── ui/                  # Card, Badge, Alert, Modal primitives
│   ├── plaid/               # PlaidLink button component
│   ├── dashboard/           # SpendingChart, BudgetCard, InsightCard
│   ├── transactions/        # TransactionList, TransactionRow
│   ├── budget/              # BudgetProgress, BudgetForm
│   └── subscriptions/       # SubscriptionCard
│
├── pages/
│   ├── index.tsx            # Dashboard
│   ├── transactions.tsx     # Full transaction list
│   ├── budget.tsx           # Budget & analytics
│   ├── subscriptions.tsx    # Subscription management
│   ├── settings.tsx         # Profile & account settings
│   ├── auth/
│   │   ├── login.tsx
│   │   └── signup.tsx
│   └── api/
│       ├── plaid/
│       │   ├── create-link-token.ts  # Step 1: create Plaid Link token
│       │   ├── exchange-token.ts     # Step 2: exchange public → access token
│       │   └── fetch-transactions.ts # Step 3: sync transactions
│       ├── transactions/
│       │   └── categorize.ts        # Re-categorize transactions
│       ├── budget/
│       │   ├── index.ts             # GET/POST budgets
│       │   └── recommendations.ts   # AI budget suggestions
│       ├── subscriptions/
│       │   └── index.ts             # CRUD subscriptions
│       ├── user/
│       │   └── index.ts             # Get user profile + balances
│       └── insights.ts              # AI spending insights
│
└── styles/
    └── globals.css           # Tailwind + custom CSS classes
```

---

## API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/plaid/create-link-token` | POST | Create Plaid Link token for frontend |
| `/api/plaid/exchange-token` | POST | Exchange public token → access token |
| `/api/plaid/fetch-transactions` | POST | Sync transactions from Plaid |
| `/api/transactions/categorize` | POST | Re-categorize uncategorized transactions |
| `/api/budget` | GET, POST | Fetch or upsert monthly budgets |
| `/api/budget/recommendations` | POST | Get AI budget suggestions |
| `/api/subscriptions` | GET, POST, PUT | CRUD subscriptions |
| `/api/user` | GET | Get profile + account balances |
| `/api/insights` | POST | Get AI spending insights |

---

## Key Design Decisions

### Transaction Sync (Plaid Cursor API)
Uses Plaid's `transactionsSync` which is cursor-based — each sync only fetches *new* changes since the last sync. Cursors are stored per `plaid_item` so you never re-process old data.

### Dual Categorization
1. **Rule-based** (`utils/categorize.ts`) — instant, free, ~95% accurate for common merchants
2. **AI** (`lib/openai.ts`) — more accurate for unusual merchants, costs ~$0.001/transaction

The app uses rule-based by default and falls back gracefully if OpenAI is unavailable.

### Row Level Security (RLS)
Every Supabase table has RLS enabled. Users can only ever query their own data, enforced at the database level — even if a bug in your code tries to fetch someone else's data, Postgres rejects it.

### International Student Currency Conversion
When `is_international = true` and `home_currency ≠ USD`, every new transaction gets a `amount_home_currency` field computed at sync time using live exchange rates. This avoids expensive API calls at read time.

### Subscription Detection
`utils/subscriptions.ts` runs a pure client-side algorithm on 90+ days of transactions:
1. Group by normalized merchant name
2. Find pairs with gaps of ~7 / ~30 / ~90 / ~365 days
3. Check amount consistency (±$1 tolerance)
4. Return a confidence score

---

## Deployment (Vercel + GitHub)

### One-time setup

#### 1. Push to GitHub

```bash
# Inside "Budget app" folder
git init
git add .
git commit -m "feat: initial Credix app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/credix.git
git push -u origin main
```

#### 2. Link to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Select your `credix` GitHub repo
3. Framework preset will auto-detect **Next.js** — leave defaults
4. Click **Deploy** (first deploy will fail — that's fine, env vars aren't set yet)

#### 3. Add environment variables in Vercel

Go to your Vercel project → **Settings** → **Environment Variables** and add each of these (set scope to **Production + Preview + Development**):

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server-only — never prefix with `NEXT_PUBLIC_`) |
| `PLAID_CLIENT_ID` | Plaid dashboard → Team Settings → Keys |
| `PLAID_SECRET` | Plaid dashboard → Team Settings → Keys |
| `PLAID_ENV` | `sandbox` (dev) → `production` (launch) |
| `PLAID_PRODUCTS` | `transactions,auth` |
| `PLAID_COUNTRY_CODES` | `US` (add more as needed, e.g. `US,CA,GB`) |
| `OPENAI_API_KEY` | platform.openai.com/api-keys (optional) |
| `EXCHANGE_RATES_API_KEY` | openexchangerates.org (optional) |

#### 4. Redeploy

Vercel → your project → **Deployments** → click the three dots on the latest deploy → **Redeploy**.

#### 5. Add your Vercel domain to Supabase

In Supabase → **Authentication** → **URL Configuration**:
- **Site URL**: `https://credix.vercel.app` (or your custom domain)
- **Redirect URLs**: add `https://credix.vercel.app/**`

---

### GitHub → Vercel auto-deploy flow (how it works going forward)

```
Push to any branch  →  Vercel creates a Preview URL  →  GitHub PR gets a comment with the URL
Push to main        →  Vercel deploys to Production   →  GitHub Actions runs CI (typecheck + lint + build)
```

The `.github/workflows/` files catch type errors and lint failures before Vercel deploys.

---

### Setting up a custom domain

1. Vercel → your project → **Settings** → **Domains** → Add `credix.app` (or whatever you own)
2. Follow Vercel's DNS instructions (usually a CNAME record)
3. Update Supabase Site URL to your custom domain

### Plaid Production Checklist

Before switching `PLAID_ENV=production`:
- [ ] Apply for Plaid production access
- [ ] Add `redirect_uri` to your Plaid dashboard
- [ ] Encrypt `access_token` at rest in Supabase (use pgcrypto)
- [ ] Add webhook endpoint (`/api/plaid/webhook`) for real-time updates
- [ ] Set up rate limiting on API routes

---

## Adding Plaid Webhooks (optional but recommended)

In production, instead of polling `/api/plaid/fetch-transactions`, Plaid can push updates to you:

1. Add `webhook: 'https://yourapp.com/api/plaid/webhook'` to the `linkTokenCreate` call in `create-link-token.ts`
2. Create `pages/api/plaid/webhook.ts` that handles `TRANSACTIONS_SYNC_UPDATES_AVAILABLE` events
3. Verify the webhook signature with `plaid-node`'s built-in verification

---

## Troubleshooting

**"Failed to create link token"**
→ Check `PLAID_CLIENT_ID` and `PLAID_SECRET` in `.env.local`. Make sure `PLAID_ENV=sandbox` for development.

**Transactions not appearing after connecting bank**
→ In sandbox, use the test credentials: `user_good` / `pass_good`. Then click "Sync" on the dashboard.

**"Server config error" from API routes**
→ `SUPABASE_SERVICE_ROLE_KEY` is missing. This key is required for server-side DB writes.

**AI features not working**
→ `OPENAI_API_KEY` not set. The app degrades gracefully — rule-based categorization still works.
