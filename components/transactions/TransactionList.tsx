/**
 * components/transactions/TransactionList.tsx
 * Full transactions table with search, category filter, and date filter.
 */

import { useState, useMemo } from 'react'
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline'
import { TransactionRow } from './TransactionRow'
import type { Transaction, Category } from '@/types'

interface TransactionListProps {
  transactions:     Transaction[]
  categories:       Category[]
  onUpdateCategory: (txnId: string, categoryId: string) => Promise<void>
  isLoading?:       boolean
}

export function TransactionList({
  transactions,
  categories,
  onUpdateCategory,
  isLoading,
}: TransactionListProps) {
  const [search,       setSearch]       = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'recurring'>('all')

  const filtered = useMemo(() => {
    return transactions.filter((txn) => {
      const name  = (txn.merchant_name ?? txn.name).toLowerCase()
      const query = search.toLowerCase()

      if (search    && !name.includes(query))         return false
      if (filterCat && txn.category_id !== filterCat) return false
      if (filterStatus === 'pending'   && !txn.pending)      return false
      if (filterStatus === 'recurring' && !txn.is_recurring) return false
      return true
    })
  }, [transactions, search, filterCat, filterStatus])

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Filters bar */}
      <div className="flex flex-wrap gap-3 p-4 border-b border-gray-50">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </div>

        {/* Category filter */}
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="all">All status</option>
          <option value="pending">Pending only</option>
          <option value="recurring">Recurring only</option>
        </select>

        <span className="text-xs text-gray-400 self-center ml-auto">
          {filtered.length} transactions
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50">
              <th className="px-4 py-3">Merchant</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">
                  No transactions match your filters
                </td>
              </tr>
            ) : (
              filtered.map((txn) => (
                <TransactionRow
                  key={txn.id}
                  transaction={txn}
                  categories={categories}
                  onUpdateCategory={onUpdateCategory}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
