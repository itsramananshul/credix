/**
 * utils/subscriptions.ts
 * Detects recurring subscriptions from a list of transactions.
 *
 * Algorithm:
 *  1. Group transactions by normalized merchant name
 *  2. For each merchant, check if there are 2+ transactions ~30 days apart
 *     with the same amount (±$1 tolerance)
 *  3. If yes → flag as recurring subscription candidate
 */

import type { Transaction } from '@/types'
import { differenceInDays, parseISO, addDays, format } from 'date-fns'

export interface DetectedSubscription {
  name: string
  amount: number
  currency: string
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'
  lastBilledDate: string
  nextBillingDate: string
  confidence: number
  transactionIds: string[]
}

/**
 * detectSubscriptionsFromTransactions
 * Takes 90+ days of transactions and returns detected subscription patterns.
 */
export function detectSubscriptionsFromTransactions(
  transactions: Transaction[],
): DetectedSubscription[] {
  // Only look at debits (positive amounts) — credits are not subscriptions
  const debits = transactions.filter((t) => t.amount > 0 && !t.pending)

  // Group by merchant name (normalized)
  const byMerchant = new Map<string, Transaction[]>()
  for (const txn of debits) {
    const key = normalizeMerchantName(txn.merchant_name ?? txn.name)
    const existing = byMerchant.get(key) ?? []
    existing.push(txn)
    byMerchant.set(key, existing)
  }

  const detected: DetectedSubscription[] = []

  for (const [merchantKey, txns] of Array.from(byMerchant.entries())) {
    if (txns.length < 2) continue  // Need at least 2 occurrences

    // Sort by date ascending
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date))

    // Check each consecutive pair for recurring pattern
    const patterns = findRecurringPattern(sorted)
    if (!patterns) continue

    const { frequency, confidence, matchedTxns } = patterns
    const lastTxn  = matchedTxns[matchedTxns.length - 1]
    const avgAmount = matchedTxns.reduce((sum, t) => sum + t.amount, 0) / matchedTxns.length

    detected.push({
      name:            titleCase(merchantKey),
      amount:          Math.round(avgAmount * 100) / 100,
      currency:        lastTxn.currency,
      frequency,
      lastBilledDate:  lastTxn.date,
      nextBillingDate: predictNextDate(lastTxn.date, frequency),
      confidence,
      transactionIds:  matchedTxns.map((t) => t.id),
    })
  }

  // Sort by amount descending (most expensive subscriptions first)
  return detected.sort((a, b) => b.amount - a.amount)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')  // remove punctuation
    .replace(/\s+/g, ' ')
    .trim()
    // Strip common suffixes that vary between transactions
    .replace(/\b(inc|llc|ltd|corp|co|payment|charge|autopay|recurring)\b/g, '')
    .trim()
}

function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

interface PatternResult {
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'
  confidence: number
  matchedTxns: Transaction[]
}

function findRecurringPattern(sorted: Transaction[]): PatternResult | null {
  const FREQUENCY_RANGES = [
    { frequency: 'weekly'    as const, minDays:  5, maxDays:  9, confidence: 0.90 },
    { frequency: 'monthly'   as const, minDays: 25, maxDays: 35, confidence: 0.95 },
    { frequency: 'quarterly' as const, minDays: 85, maxDays: 95, confidence: 0.85 },
    { frequency: 'annual'    as const, minDays: 355, maxDays: 375, confidence: 0.80 },
  ]

  // Calculate gaps between consecutive transactions
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date)))
  }

  if (gaps.length === 0) return null

  // Check if amounts are consistent (within $1)
  const amounts = sorted.map((t) => t.amount)
  const minAmt  = Math.min(...amounts)
  const maxAmt  = Math.max(...amounts)
  if (maxAmt - minAmt > 1.0) return null  // amounts too variable

  // Find which frequency pattern fits the gaps
  for (const { frequency, minDays, maxDays, confidence } of FREQUENCY_RANGES) {
    const matchingGaps = gaps.filter((g) => g >= minDays && g <= maxDays)
    if (matchingGaps.length === gaps.length) {
      return { frequency, confidence, matchedTxns: sorted }
    }
  }

  return null
}

function predictNextDate(lastDate: string, frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual'): string {
  const daysToAdd: Record<string, number> = {
    weekly: 7, monthly: 30, quarterly: 91, annual: 365,
  }
  const next = addDays(parseISO(lastDate), daysToAdd[frequency])
  return format(next, 'yyyy-MM-dd')
}

/**
 * getDaysUntilNextBilling
 * Returns days until the next billing date (can be negative if overdue).
 */
export function getDaysUntilNextBilling(nextBillingDate: string): number {
  return differenceInDays(parseISO(nextBillingDate), new Date())
}

/**
 * getMonthlyEquivalent
 * Normalizes any subscription frequency to a monthly amount.
 */
export function getMonthlyEquivalent(amount: number, frequency: string): number {
  const divisors: Record<string, number> = {
    weekly: 1 / 4.33, monthly: 1, quarterly: 1 / 3, annual: 1 / 12,
  }
  return amount * (1 / (divisors[frequency] ?? 1))
}
