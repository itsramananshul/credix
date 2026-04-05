/**
 * components/subscriptions/SubscriptionCard.tsx
 * Card for a single subscription — shows billing info, frequency, and cancel button.
 */

import { useState } from 'react'
import { XMarkIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { Badge } from '@/components/ui/Badge'
import type { Subscription } from '@/types'
import { formatAmount, annualCost } from '@/utils/formatters'
import { getDaysUntilNextBilling } from '@/utils/subscriptions'
import { clsx } from 'clsx'

interface SubscriptionCardProps {
  subscription: Subscription
  onCancel:     (id: string) => void
  currency?:    string
}

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual',
}

export function SubscriptionCard({ subscription: sub, onCancel, currency = 'USD' }: SubscriptionCardProps) {
  const [confirming, setConfirming] = useState(false)

  const daysUntil = sub.next_billing_date ? getDaysUntilNextBilling(sub.next_billing_date) : null
  const isBillingSoon = daysUntil !== null && daysUntil <= 3 && daysUntil >= 0
  const yearlyEquiv   = annualCost(sub.amount, sub.frequency)

  return (
    <div className={clsx(
      'bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow',
      isBillingSoon ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100',
    )}>
      <div className="flex items-start justify-between gap-3">
        {/* Icon + name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl">
            {sub.category?.icon ?? '📱'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{sub.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={sub.frequency === 'annual' ? 'purple' : 'default'}>
                {FREQUENCY_LABELS[sub.frequency]}
              </Badge>
              {sub.is_auto_detected && (
                <Badge variant="info">Auto-detected</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-gray-900">
            {formatAmount(sub.amount, sub.currency ?? currency)}
          </p>
          <p className="text-xs text-gray-400">
            {formatAmount(yearlyEquiv, sub.currency ?? currency)}/yr
          </p>
        </div>
      </div>

      {/* Next billing */}
      {sub.next_billing_date && (
        <div className={clsx(
          'flex items-center gap-1.5 mt-3 text-xs',
          isBillingSoon ? 'text-amber-600 font-medium' : 'text-gray-400',
        )}>
          <CalendarIcon className="h-3.5 w-3.5" />
          {daysUntil === 0
            ? 'Billing today!'
            : daysUntil === 1
              ? 'Billing tomorrow!'
              : daysUntil !== null && daysUntil > 0
                ? `Next billing in ${daysUntil} days (${sub.next_billing_date})`
                : `Last billed: ${sub.last_billed_date}`
          }
        </div>
      )}

      {/* Cancel button */}
      <div className="mt-3 pt-3 border-t border-gray-50">
        {confirming ? (
          <div className="flex gap-2">
            <button
              onClick={() => { onCancel(sub.id); setConfirming(false) }}
              className="flex-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 py-1.5 rounded-lg transition-colors"
            >
              Confirm cancel
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-gray-500 hover:text-gray-700 px-3"
            >
              Keep it
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            <XMarkIcon className="h-3.5 w-3.5" />
            Mark as cancelled
          </button>
        )}
      </div>
    </div>
  )
}
