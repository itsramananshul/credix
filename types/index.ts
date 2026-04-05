/**
 * types/index.ts
 * Shared TypeScript types used across the entire application.
 * Keep this in sync with the Supabase schema.
 */

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  home_currency: string
  is_international: boolean
  university: string | null
  student_type: 'undergraduate' | 'graduate' | 'phd' | 'other' | null
  notification_prefs: NotificationPrefs
  created_at: string
  updated_at: string
}

export interface NotificationPrefs {
  email: boolean
  budget_alerts: boolean
  subscription_alerts: boolean
}

export interface Category {
  id: string
  user_id: string | null
  name: string
  icon: string | null
  color: string | null
  is_system: boolean
  category_type: CategoryType
  created_at: string
}

export type CategoryType =
  | 'food' | 'transport' | 'housing' | 'education' | 'health' | 'fitness'
  | 'entertainment' | 'subscriptions' | 'shopping' | 'travel' | 'income'
  | 'savings' | 'utilities' | 'personal_care' | 'other'

export interface PlaidItem {
  id: string
  user_id: string
  item_id: string
  institution_id: string | null
  institution_name: string | null
  transaction_cursor: string | null
  status: 'active' | 'error' | 'disconnected'
  error_code: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  user_id: string
  plaid_item_id: string
  plaid_account_id: string
  name: string
  official_name: string | null
  type: string | null
  subtype: string | null
  currency: string
  balance_available: number | null
  balance_current: number | null
  balance_limit: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  bank_account_id: string | null
  plaid_transaction_id: string | null
  amount: number
  currency: string
  amount_home_currency: number | null
  home_currency: string | null
  exchange_rate_used: number | null
  name: string
  merchant_name: string | null
  logo_url: string | null
  date: string
  authorized_date: string | null
  category_id: string | null
  plaid_category: string[] | null
  plaid_category_id: string | null
  user_overrode_category: boolean
  pending: boolean
  is_recurring: boolean
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields (from category)
  category?: Category
}

export interface Budget {
  id: string
  user_id: string
  category_id: string
  year: number
  month: number
  amount: number
  currency: string
  alert_at_percent: number
  created_at: string
  updated_at: string
  // Joined
  category?: Category
}

export interface Subscription {
  id: string
  user_id: string
  name: string
  merchant_name: string | null
  amount: number
  currency: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'
  category_id: string | null
  next_billing_date: string | null
  last_billed_date: string | null
  is_auto_detected: boolean
  detection_confidence: number | null
  status: 'active' | 'cancelled' | 'paused'
  notes: string | null
  logo_url: string | null
  created_at: string
  updated_at: string
  category?: Category
}

// ─── View Types ───────────────────────────────────────────────────────────────

export interface SpendingByCategory {
  user_id: string
  category_id: string
  category_name: string
  icon: string | null
  color: string | null
  category_type: CategoryType
  year: number
  month: number
  total_spent: number
  transaction_count: number
}

export interface BudgetVsActual {
  user_id: string
  category_id: string
  category_name: string
  icon: string | null
  color: string | null
  year: number
  month: number
  budget_amount: number
  spent: number
  remaining: number
  percent_used: number
}

// ─── API Request / Response Types ────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface FetchTransactionsResponse {
  added: Transaction[]
  modified: Transaction[]
  removed: string[]  // plaid_transaction_ids
  hasMore: boolean
}

export interface PlaidLinkSuccessMetadata {
  institution: { name: string; institution_id: string }
  accounts: Array<{ id: string; name: string; type: string; subtype: string }>
  link_session_id: string
}

// ─── UI / Component Types ────────────────────────────────────────────────────

export type AlertVariant = 'success' | 'warning' | 'danger' | 'info'

export interface ChartDataPoint {
  name: string
  value: number
  color?: string
  icon?: string
}

export interface DateRange {
  from: Date
  to: Date
}

// Minimal database type stub — replaced by generated types from Supabase CLI
export type Database = {
  public: {
    Tables: {
      profiles:      { Row: Profile }
      categories:    { Row: Category }
      plaid_items:   { Row: PlaidItem }
      bank_accounts: { Row: BankAccount }
      transactions:  { Row: Transaction }
      budgets:       { Row: Budget }
      subscriptions: { Row: Subscription }
    }
    Views: {
      v_spending_by_category: { Row: SpendingByCategory }
      v_budget_vs_actual:     { Row: BudgetVsActual }
    }
  }
}
