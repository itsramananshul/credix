/**
 * pages/index.tsx — Dashboard Page
 *
 * Shows:
 *  - Account balances (from connected bank accounts)
 *  - Spending pie/bar chart for the current month
 *  - Budget progress cards
 *  - Recent transactions (last 5)
 *  - AI-powered spending insights
 *  - Quick "Connect bank" CTA if no accounts are linked yet
 */

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTransactions } from '@/hooks/useTransactions'
import { useBudgets } from '@/hooks/useBudgets'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { BudgetCard } from '@/components/dashboard/BudgetCard'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { InsightCard } from '@/components/dashboard/InsightCard'
import { TellerConnectButton } from '@/components/teller/TellerConnect'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import type { SpendingByCategory, BankAccount } from '@/types'
import { formatAmount } from '@/utils/formatters'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const { profile } = useAuth()
  const currency     = profile?.home_currency ?? 'USD'

  // ── Data fetching ───────────────────────────��────────────────────────────
  const { transactions, isLoading: txLoading } = useTransactions({ year, month, limit: 50 })
  const { budgets }                             = useBudgets(year, month)

  // Fetch spending by category from the view
  const { data: spending = [] } = useSWR<SpendingByCategory[]>(
    ['spending_by_category', year, month],
    async () => {
      const { data } = await supabase
        .from('v_spending_by_category')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .order('total_spent', { ascending: false })
      return (data ?? []) as SpendingByCategory[]
    },
  )

  // Fetch bank accounts
  const { data: accounts = [], mutate: refetchAccounts } = useSWR<BankAccount[]>(
    'bank_accounts',
    async () => {
      const { data } = await supabase.from('bank_accounts').select('*').eq('is_active', true)
      return (data ?? []) as BankAccount[]
    },
  )

  // AI insights (optional — only fires if OPENAI_API_KEY is set)
  const [insights, setInsights] = useState<string[]>([])
  useEffect(() => {
    if (spending.length === 0 || budgets.length === 0) return
    fetch('/api/insights', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ spending, budgets }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.insights) setInsights(d.insights) })
      .catch(() => {})  // insights are optional — silently fail
  }, [spending.length, budgets.length])

  // ── Actions ──────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false)
  async function syncTransactions() {
    setSyncing(true)
    try {
      const res = await fetch('/api/teller/fetch-transactions', { method: 'POST' })
      const data = await res.json()
      toast.success(`Synced ${data.added ?? 0} new transactions`)
      refetchAccounts()
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // Total balance across all accounts
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance_current ?? 0), 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">
            Good {getGreeting()}, {profile?.full_name?.split(' ')[0] ?? 'there'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="flex gap-2">
          {accounts.length > 0 && (
            <button
              onClick={syncTransactions}
              disabled={syncing}
              className="btn-secondary flex items-center gap-2"
            >
              <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}
          <TellerConnectButton onSuccess={() => { refetchAccounts(); toast.success('Bank connected!') }} />
        </div>
      </div>

      {/* No accounts CTA */}
      {accounts.length === 0 && (
        <Alert variant="info" title="Connect your bank to get started">
          Link a bank account using Teller and we&apos;ll automatically import your transactions,
          detect subscriptions, and track your budgets.
        </Alert>
      )}

      {/* Balance summary cards */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="col-span-2 md:col-span-1">
            <p className="text-xs text-gray-400 mb-1">Total Balance</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatAmount(totalBalance, 'USD')}
            </p>
            {profile?.is_international && (
              <p className="text-xs text-gray-400 mt-0.5">
                ≈ {formatAmount(totalBalance, currency)} {currency}
              </p>
            )}
          </Card>

          {accounts.slice(0, 3).map((acc) => (
            <Card key={acc.id}>
              <p className="text-xs text-gray-400 truncate mb-1">{acc.name}</p>
              <p className="text-lg font-bold text-gray-900">
                {formatAmount(acc.balance_current ?? 0, acc.currency)}
              </p>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{acc.subtype}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: chart + transactions */}
        <div className="lg:col-span-2 space-y-6">
          <SpendingChart data={spending} currency={currency} />
          <RecentTransactions transactions={transactions} currency={currency} />
        </div>

        {/* Right column: budgets + insights */}
        <div className="space-y-6">
          {/* Budget overview */}
          <Card title="This Month's Budgets" subtitle={`${budgets.length} categories`}>
            {budgets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No budgets set yet.{' '}
                <a href="/budget" className="text-primary-600 hover:underline">Set budgets →</a>
              </p>
            ) : (
              <div className="space-y-3">
                {budgets.slice(0, 5).map((b) => (
                  <BudgetCard key={b.category_id} budget={b} currency={currency} />
                ))}
                {budgets.length > 5 && (
                  <a href="/budget" className="block text-xs text-center text-primary-600 hover:underline mt-2">
                    View all {budgets.length} budgets →
                  </a>
                )}
              </div>
            )}
          </Card>

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">AI Insights ✨</h3>
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
