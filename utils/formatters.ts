/**
 * utils/formatters.ts
 * Pure formatting helpers used throughout the UI.
 * No side effects, no imports beyond date-fns.
 */

import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns'

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as currency string.
 * @example formatAmount(1234.5, 'USD') → "$1,234.50"
 */
export function formatAmount(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style:                 'currency',
    currency:              currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
}

/**
 * Returns a sign-aware formatted amount with + / - prefix.
 * Positive amount = debit (money out) → shown as "-$50.00" in red
 * Negative amount = credit (money in) → shown as "+$50.00" in green
 */
export function formatAmountSigned(amount: number, currency = 'USD'): string {
  const abs = formatAmount(amount, currency)
  return amount < 0 ? `+${abs}` : `-${abs}`
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * Format a date string for display in transaction rows.
 * Shows "Today", "Yesterday", or "Mar 15" style for older dates.
 */
export function formatTransactionDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date))     return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  return format(date, 'MMM d')
}

/**
 * Format a full date for detail views.
 * @example formatDate('2024-03-15') → "March 15, 2024"
 */
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMMM d, yyyy')
}

/**
 * Format a month/year for budget period headers.
 * @example formatMonthYear(2024, 3) → "March 2024"
 */
export function formatMonthYear(year: number, month: number): string {
  return format(new Date(year, month - 1, 1), 'MMMM yyyy')
}

/**
 * Relative time (e.g. "2 hours ago", "3 days ago").
 */
export function timeAgo(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true })
}

// ─── Numbers / Percentages ────────────────────────────────────────────────────

/**
 * Format a decimal as a percentage string.
 * @example formatPercent(0.756) → "75.6%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// ─── Strings ─────────────────────────────────────────────────────────────────

/**
 * Truncate a string to maxLen characters, appending "…".
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

/**
 * Capitalize the first letter of each word.
 */
export function titleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

// ─── Budget Helpers ───────────────────────────────────────────────────────────

/**
 * Returns a Tailwind color class based on % of budget used.
 *   0–60%  → green (on track)
 *   60–85% → yellow (warning)
 *   85%+   → red (danger)
 */
export function budgetStatusColor(percentUsed: number): string {
  if (percentUsed >= 85) return 'text-red-500'
  if (percentUsed >= 60) return 'text-yellow-500'
  return 'text-green-500'
}

export function budgetBarColor(percentUsed: number): string {
  if (percentUsed >= 85) return 'bg-red-500'
  if (percentUsed >= 60) return 'bg-yellow-500'
  return 'bg-green-500'
}

/**
 * Annual cost of a subscription based on frequency.
 */
export function annualCost(amount: number, frequency: string): number {
  const multipliers: Record<string, number> = {
    weekly:    52,
    monthly:   12,
    quarterly:  4,
    annual:     1,
  }
  return amount * (multipliers[frequency] ?? 12)
}
