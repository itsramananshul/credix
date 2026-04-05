/**
 * components/dashboard/InsightCard.tsx
 * Displays an AI-generated spending insight with a light-bulb icon.
 * Insights are strings returned from /api/insights.
 */

import { LightBulbIcon } from '@heroicons/react/24/outline'

interface InsightCardProps {
  insight: string
  index:   number
}

const BG_COLORS = [
  'bg-indigo-50  border-indigo-100',
  'bg-amber-50   border-amber-100',
  'bg-emerald-50 border-emerald-100',
]

const ICON_COLORS = ['text-indigo-500', 'text-amber-500', 'text-emerald-500']

export function InsightCard({ insight, index }: InsightCardProps) {
  const i = index % 3
  return (
    <div className={`flex gap-3 p-4 rounded-xl border ${BG_COLORS[i]} animate-fade-in`}>
      <LightBulbIcon className={`h-5 w-5 shrink-0 mt-0.5 ${ICON_COLORS[i]}`} />
      <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
    </div>
  )
}
