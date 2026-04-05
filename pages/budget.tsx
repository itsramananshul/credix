/**
 * pages/budget.tsx — Budget & Analytics Page
 *
 * Features:
 *  - Budget progress bars per category
 *  - Monthly spending trend chart (last 6 months)
 *  - Student-specific alerts (tuition, rent, food warnings)
 *  - AI budget recommendations button
 */

import { useState } from 'react'
import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useBudgets } from '@/hooks/useBudgets'
import { BudgetProgress } from '@/components/budget/BudgetProgress'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import type { Category, SpendingByCategory } from '@/types'
import { formatAmount, formatMonthYear } from '@/utils/formatters'
import { ChevronLeftIcon, ChevronRightIcon, SparklesIcon } from '@heroicons/react/24/outline'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import toast from 'react-hot-toast'

export default function BudgetPage() {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loadingAI, setLoadingAI] = useState(false)

  const { profile } = useAuth()
  const currency     = profile?.home_currency ?? 'USD'

  const { budgets, isLoading, upsertBudget } = useBudgets(year, month)

  const { data: categories = [] } = useSWR<Category[]>('categories', async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    return (data ?? []) as Category[]
  })

  const { data: spending = [] } = useSWR<SpendingByCategory[]>(
    ['spending_by_category', year, month],
    async () => {
      const { data } = await supabase
        .from('v_spending_by_category')
        .select('*')
        .eq('year', year)
        .eq('month', month)
      return (data ?? []) as SpendingByCategory[]
    },
  )

  // Last 6 months of total spending for the trend chart
  const { data: trendData = [] } = useSWR('spending_trend', async () => {
    const results = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const { data } = await supabase
        .from('v_spending_by_category')
        .select('total_spent')
        .eq('year', y)
        .eq('month', m)
      const total = (data ?? []).reduce((sum: number, r: any) => sum + Number(r.total_spent), 0)
      results.push({
        name: new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short' }),
        spending: Math.round(total),
      })
    }
    return results
  })

  // Student-specific budget alerts
  const overBudgetAlerts = budgets.filter((b) => b.percent_used > 100)
  const nearLimitAlerts  = budgets.filter((b) => b.percent_used >= 80 && b.percent_used <= 100)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  async function getAIRecommendations() {
    setLoadingAI(true)
    try {
      const res  = await fetch('/api/budget/recommendations', { method: 'POST' })
      const data = await res.json()
      if (data.recommendations) {
        toast.success('AI recommendations applied!')
        // Auto-upsert the recommended budgets
        for (const [catType, amount] of Object.entries(data.recommendations)) {
          const cat = categories.find((c) => c.category_type === catType)
          if (cat) await upsertBudget(cat.id, amount as number, currency)
        }
      }
    } catch {
      toast.error('AI recommendations unavailable')
    } finally {
      setLoadingAI(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Budget & Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Track your spending against your goals</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month nav */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-50 text-gray-500">
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-gray-900 px-2 min-w-[130px] text-center">
              {formatMonthYear(year, month)}
            </span>
            <button
              onClick={nextMonth}
              disabled={year === now.getFullYear() && month === now.getMonth() + 1}
              className="p-1 rounded hover:bg-gray-50 text-gray-500 disabled:opacity-30"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={getAIRecommendations}
            disabled={loadingAI}
            className="btn-secondary flex items-center gap-2"
          >
            <SparklesIcon className="h-4 w-4 text-indigo-500" />
            {loadingAI ? 'Analyzing…' : 'AI Suggestions'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {overBudgetAlerts.map((b) => (
        <Alert key={b.category_id} variant="danger" title={`Over budget: ${b.category_name}`}>
          You&apos;ve spent {formatAmount(b.spent, currency)} — {formatAmount(Math.abs(b.remaining), currency)} over your {formatAmount(b.budget_amount, currency)} budget.
        </Alert>
      ))}
      {nearLimitAlerts.map((b) => (
        <Alert key={b.category_id} variant="warning" title={`Approaching limit: ${b.category_name}`}>
          {b.percent_used.toFixed(0)}% used — only {formatAmount(b.remaining, currency)} left.
        </Alert>
      ))}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget progress list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="section-title">Category Budgets</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <BudgetProgress
              budgets={budgets}
              categories={categories}
              onUpsert={upsertBudget}
              currency={currency}
            />
          )}
        </div>

        {/* Right column: spending chart + trend */}
        <div className="space-y-6">
          <SpendingChart data={spending} currency={currency} />

          {/* 6-month trend */}
          <Card title="6-Month Trend" subtitle="Total monthly spending">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(v: any) => [formatAmount(v, currency), 'Spending']}
                  contentStyle={{ borderRadius: 12, border: '1px solid #f3f4f6', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="spending"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  )
}
