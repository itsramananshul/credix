/**
 * components/dashboard/RecentTransactions.tsx
 * Shows the 5 most recent transactions on the dashboard.
 * Links to /transactions for the full list.
 */

import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import type { Transaction } from '@/types'
import { formatAmount, formatTransactionDate } from '@/utils/formatters'
import { clsx } from 'clsx'

interface RecentTransactionsProps {
  transactions: Transaction[]
  currency?:    string
}

export function RecentTransactions({ transactions, currency = 'USD' }: RecentTransactionsProps) {
  const recent = transactions.slice(0, 5)

  return (
    <Card
      title="Recent Transactions"
      action={
        <Link href="/transactions" className="text-xs text-primary-600 hover:underline font-medium">
          View all →
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">
          No transactions yet. Connect a bank account to get started.
        </p>
      ) : (
        <div className="divide-y divide-gray-50">
          {recent.map((txn) => (
            <div key={txn.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              {/* Category icon */}
              <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-50 shrink-0 text-lg leading-none">
                {txn.category?.icon ?? '📦'}
              </div>

              {/* Name + category */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {txn.merchant_name ?? txn.name}
                </p>
                <p className="text-xs text-gray-400">
                  {formatTransactionDate(txn.date)}
                  {txn.category && (
                    <> · <span style={{ color: txn.category.color ?? '#94a3b8' }}>
                      {txn.category.name}
                    </span></>
                  )}
                  {txn.pending && <> · <span className="text-yellow-500">Pending</span></>}
                </p>
              </div>

              {/* Amount */}
              <span
                className={clsx(
                  'text-sm font-semibold shrink-0',
                  txn.amount < 0 ? 'text-green-600' : 'text-gray-900',
                )}
              >
                {txn.amount < 0 ? '+' : '-'}
                {formatAmount(txn.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
