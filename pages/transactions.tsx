/**
 * pages/transactions.tsx — Transactions Page
 *
 * Full paginated transaction list with:
 *  - Month/year selector
 *  - Search + category + status filters
 *  - Inline category override
 *  - "Sync now" button
 */

import { useState } from 'react'
import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import { useTransactions } from '@/hooks/useTransactions'
import { TransactionList } from '@/components/transactions/TransactionList'
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import type { Category } from '@/types'
import { formatMonthYear } from '@/utils/formatters'
import toast from 'react-hot-toast'

export default function TransactionsPage() {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [syncing, setSyncing] = useState(false)

  const { transactions, isLoading, updateCategory } = useTransactions({ year, month, limit: 500 })

  // Load all categories for the dropdown
  const { data: categories = [] } = useSWR<Category[]>('categories', async () => {
    const { data } = await supabase.from('categories').select('*').order('name')
    return (data ?? []) as Category[]
  })

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
  }

  async function syncNow() {
    setSyncing(true)
    try {
      const res  = await fetch('/api/plaid/fetch-transactions', { method: 'POST' })
      const data = await res.json()
      toast.success(`Synced ${data.added ?? 0} new transactions`)
    } catch {
      toast.error('Sync failed — are bank accounts connected?')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="text-gray-500 text-sm mt-1">{transactions.length} transactions this period</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month navigation */}
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
            onClick={syncNow}
            disabled={syncing}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Transactions table */}
      <TransactionList
        transactions={transactions}
        categories={categories}
        onUpdateCategory={updateCategory}
        isLoading={isLoading}
      />
    </div>
  )
}
