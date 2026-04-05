/**
 * components/transactions/TransactionRow.tsx
 * A single row in the transactions table.
 * Includes inline category override via a select dropdown.
 */

import { useState } from 'react'
import { clsx } from 'clsx'
import { PencilIcon, CheckIcon } from '@heroicons/react/24/outline'
import type { Transaction, Category } from '@/types'
import { formatAmount, formatDate } from '@/utils/formatters'
import { Badge } from '@/components/ui/Badge'

interface TransactionRowProps {
  transaction: Transaction
  categories:  Category[]
  onUpdateCategory: (txnId: string, categoryId: string) => Promise<void>
}

export function TransactionRow({ transaction: txn, categories, onUpdateCategory }: TransactionRowProps) {
  const [editing,   setEditing]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [catId,     setCatId]     = useState(txn.category_id ?? '')

  async function handleSave() {
    if (!catId || catId === txn.category_id) { setEditing(false); return }
    setSaving(true)
    try {
      await onUpdateCategory(txn.id, catId)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const isCredit = txn.amount < 0

  return (
    <tr className="hover:bg-gray-50 transition-colors group">
      {/* Icon + Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-lg shrink-0">
            {txn.category?.icon ?? '📦'}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">
              {txn.merchant_name ?? txn.name}
            </p>
            {txn.notes && <p className="text-xs text-gray-400 truncate max-w-xs">{txn.notes}</p>}
          </div>
        </div>
      </td>

      {/* Date */}
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {formatDate(txn.date)}
      </td>

      {/* Category (editable) */}
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              <option value="">-- Select --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 rounded-md bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
            >
              <CheckIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {txn.category ? (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: (txn.category.color ?? '#94a3b8') + '20',
                  color:       txn.category.color ?? '#94a3b8',
                }}
              >
                {txn.category.icon} {txn.category.name}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Uncategorized</span>
            )}
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-700 transition-opacity"
            >
              <PencilIcon className="h-3 w-3" />
            </button>
          </div>
        )}
      </td>

      {/* Status badges */}
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          {txn.pending      && <Badge variant="warning">Pending</Badge>}
          {txn.is_recurring && <Badge variant="purple">Recurring</Badge>}
        </div>
      </td>

      {/* Amount */}
      <td className={clsx('px-4 py-3 text-sm font-semibold text-right whitespace-nowrap',
        isCredit ? 'text-green-600' : 'text-gray-900',
      )}>
        {isCredit ? '+' : '-'}{formatAmount(txn.amount, txn.currency)}
        {/* Show home currency if different */}
        {txn.amount_home_currency && txn.home_currency && txn.home_currency !== txn.currency && (
          <p className="text-xs text-gray-400 font-normal">
            ≈ {formatAmount(txn.amount_home_currency, txn.home_currency)}
          </p>
        )}
      </td>
    </tr>
  )
}
