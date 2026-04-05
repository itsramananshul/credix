/**
 * components/dashboard/BudgetCard.tsx
 * Shows remaining budget for a single category with a progress bar.
 * Color shifts green → yellow → red as spending approaches the limit.
 */

import Link from 'next/link'
import { clsx } from 'clsx'
import type { BudgetVsActual } from '@/types'
import { formatAmount, budgetBarColor, budgetStatusColor, clamp } from '@/utils/formatters'

interface BudgetCardProps {
  budget: BudgetVsActual
  currency?: string
}

export function BudgetCard({ budget, currency = 'USD' }: BudgetCardProps) {
  const pct        = Number(budget.percent_used) || 0
  const barWidth   = clamp(pct, 0, 100)
  const isOver     = pct > 100

  return (
    <div className="flex flex-col gap-2 p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{budget.icon ?? '📦'}</span>
          <span className="text-sm font-medium text-gray-900 truncate max-w-[120px]">
            {budget.category_name}
          </span>
        </div>
        {isOver && (
          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            Over!
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-500', budgetBarColor(pct))}
          style={{ width: `${barWidth}%` }}
        />
      </div>

      {/* Amounts */}
      <div className="flex items-center justify-between text-xs">
        <span className={clsx('font-semibold', budgetStatusColor(pct))}>
          {formatAmount(budget.spent, currency)} spent
        </span>
        <span className="text-gray-400">
          of {formatAmount(budget.budget_amount, currency)}
        </span>
      </div>

      {/* Remaining */}
      <p className="text-xs text-gray-500">
        {isOver
          ? <span className="text-red-600 font-medium">{formatAmount(Math.abs(budget.remaining), currency)} over budget</span>
          : <><span className="font-medium text-gray-700">{formatAmount(budget.remaining, currency)}</span> remaining</>
        }
      </p>
    </div>
  )
}
