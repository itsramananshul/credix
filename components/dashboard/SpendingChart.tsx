/**
 * components/dashboard/SpendingChart.tsx
 * Dual-view chart: PieChart for category breakdown, BarChart for monthly trends.
 * Uses Recharts — no extra setup needed beyond `npm install recharts`.
 */

import { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import type { SpendingByCategory } from '@/types'
import { formatAmount } from '@/utils/formatters'

interface SpendingChartProps {
  data:      SpendingByCategory[]
  currency?: string
}

// Fallback colors when a category has no color set
const DEFAULT_COLORS = [
  '#6366f1','#f97316','#22c55e','#ef4444','#f59e0b',
  '#3b82f6','#ec4899','#14b8a6','#8b5cf6','#64748b',
]

export function SpendingChart({ data, currency = 'USD' }: SpendingChartProps) {
  const [view, setView] = useState<'pie' | 'bar'>('pie')

  // Transform data for charts
  const chartData = data
    .filter((d) => d.total_spent > 0)
    .sort((a, b) => b.total_spent - a.total_spent)
    .map((d, i) => ({
      name:  `${d.icon ?? ''} ${d.category_name}`,
      value: Number(d.total_spent.toFixed(2)),
      color: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    }))

  const total = chartData.reduce((sum, d) => sum + d.value, 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const { name, value } = payload[0].payload
    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
    return (
      <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-sm">
        <p className="font-medium text-gray-900">{name}</p>
        <p className="text-gray-600">{formatAmount(value, currency)} ({pct}%)</p>
      </div>
    )
  }

  return (
    <Card
      title="Spending Breakdown"
      subtitle={`Total: ${formatAmount(total, currency)}`}
      action={
        <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
          {(['pie', 'bar'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md transition-colors capitalize ${
                view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      }
    >
      {chartData.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-sm text-gray-400">
          No spending data yet
        </div>
      ) : view === 'pie' ? (
        <div className="flex flex-col md:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-col gap-2 min-w-[160px]">
            {chartData.slice(0, 6).map((d) => (
              <div key={d.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                <span className="text-gray-600 truncate">{d.name}</span>
                <span className="ml-auto font-medium text-gray-900">{formatAmount(d.value, currency)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
