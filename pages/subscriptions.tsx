/**
 * pages/subscriptions.tsx — Subscriptions Management Page
 *
 * Features:
 *  - List of active subscriptions with billing dates
 *  - Auto-detection from recent transactions
 *  - Cancel / pause subscriptions
 *  - Monthly cost summary
 *  - Upcoming billing alerts (billing in ≤3 days)
 */

import { useState } from 'react'
import { useSubscriptions } from '@/hooks/useSubscriptions'
import { useTransactions } from '@/hooks/useTransactions'
import { SubscriptionCard } from '@/components/subscriptions/SubscriptionCard'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { detectSubscriptionsFromTransactions } from '@/utils/subscriptions'
import type { Subscription } from '@/types'
import { formatAmount } from '@/utils/formatters'
import { MagnifyingGlassCircleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

export default function SubscriptionsPage() {
  const { profile }   = useAuth()
  const currency       = profile?.home_currency ?? 'USD'
  const [detecting, setDetecting] = useState(false)

  const { subscriptions, isLoading, monthlyTotal, cancelSubscription, addSubscription, mutate } = useSubscriptions()

  // Load 90 days of transactions for detection
  const { transactions } = useTransactions({ limit: 300 })

  // Subscriptions billing in ≤3 days
  const billingSoon = subscriptions.filter((s) => {
    if (!s.next_billing_date) return false
    const days = Math.ceil(
      (new Date(s.next_billing_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
    return days >= 0 && days <= 3
  })

  async function runDetection() {
    setDetecting(true)
    try {
      const detected = detectSubscriptionsFromTransactions(transactions)

      if (detected.length === 0) {
        toast('No new subscriptions detected', { icon: '🔍' })
        return
      }

      // Save newly detected subscriptions (skip ones already in DB)
      const existingNames = subscriptions.map((s) => s.name.toLowerCase())
      let added = 0

      for (const sub of detected) {
        if (existingNames.includes(sub.name.toLowerCase())) continue
        await addSubscription({
          name:              sub.name,
          amount:            sub.amount,
          currency:          sub.currency,
          frequency:         sub.frequency,
          next_billing_date: sub.nextBillingDate,
          last_billed_date:  sub.lastBilledDate,
          is_auto_detected:  true,
          detection_confidence: sub.confidence,
          status: 'active',
        } as Partial<Subscription>)
        added++
      }

      if (added > 0) {
        toast.success(`Detected ${added} new subscription${added > 1 ? 's' : ''}!`)
        mutate()
      } else {
        toast('All detected subscriptions already tracked', { icon: '✅' })
      }
    } finally {
      setDetecting(false)
    }
  }

  // Annual cost of all active subscriptions
  const annualTotal = subscriptions.reduce((sum, s) => {
    const yearly = s.frequency === 'monthly' ? s.amount * 12
                 : s.frequency === 'weekly'  ? s.amount * 52
                 : s.frequency === 'quarterly' ? s.amount * 4
                 : s.amount
    return sum + yearly
  }, 0)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Subscriptions</h1>
          <p className="text-gray-500 text-sm mt-1">
            {subscriptions.length} active · {formatAmount(monthlyTotal, currency)}/month
          </p>
        </div>

        <button
          onClick={runDetection}
          disabled={detecting}
          className="btn-secondary flex items-center gap-2"
        >
          <MagnifyingGlassCircleIcon className="h-4 w-4 text-indigo-500" />
          {detecting ? 'Detecting…' : 'Auto-Detect'}
        </button>
      </div>

      {/* Billing soon alerts */}
      {billingSoon.map((s) => (
        <Alert
          key={s.id}
          variant="warning"
          title={`Upcoming charge: ${s.name}`}
        >
          {formatAmount(s.amount, s.currency ?? currency)} due on {s.next_billing_date}
        </Alert>
      ))}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-400 mb-1">Monthly Total</p>
          <p className="text-xl font-bold text-gray-900">{formatAmount(monthlyTotal, currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">Annual Total</p>
          <p className="text-xl font-bold text-gray-900">{formatAmount(annualTotal, currency)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400 mb-1">Active Subscriptions</p>
          <p className="text-xl font-bold text-gray-900">{subscriptions.length}</p>
        </Card>
      </div>

      {/* Subscription cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <p className="text-4xl mb-3">📱</p>
          <p className="text-sm font-medium text-gray-600">No subscriptions tracked yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Click &quot;Auto-Detect&quot; to scan your transactions for recurring charges.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptions.map((sub) => (
            <SubscriptionCard
              key={sub.id}
              subscription={sub}
              onCancel={cancelSubscription}
              currency={currency}
            />
          ))}
        </div>
      )}
    </div>
  )
}
