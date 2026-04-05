/**
 * components/budget/BudgetProgress.tsx
 * Full budget progress list — one row per category with edit capability.
 */

import { useState } from 'react'
import { PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { BudgetVsActual, Category } from '@/types'
import { formatAmount, budgetBarColor, budgetStatusColor, clamp } from '@/utils/formatters'
import { Modal } from '@/components/ui/Modal'

interface BudgetProgressProps {
  budgets:       BudgetVsActual[]
  categories:    Category[]
  onUpsert:      (categoryId: string, amount: number) => Promise<void>
  currency?:     string
}

export function BudgetProgress({ budgets, categories, onUpsert, currency = 'USD' }: BudgetProgressProps) {
  const [modalOpen,  setModalOpen]  = useState(false)
  const [editBudget, setEditBudget] = useState<BudgetVsActual | null>(null)
  const [amount,     setAmount]     = useState('')
  const [catId,      setCatId]      = useState('')
  const [saving,     setSaving]     = useState(false)

  function openAdd() {
    setEditBudget(null)
    setAmount('')
    setCatId('')
    setModalOpen(true)
  }

  function openEdit(b: BudgetVsActual) {
    setEditBudget(b)
    setAmount(String(b.budget_amount))
    setCatId(b.category_id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!catId || !amount) return
    setSaving(true)
    try {
      await onUpsert(catId, parseFloat(amount))
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Categories without an existing budget (for the Add dropdown)
  const budgetCatIds   = budgets.map((b) => b.category_id)
  const availableCats  = categories.filter((c) => !budgetCatIds.includes(c.id))

  return (
    <div className="space-y-3">
      {budgets.map((b) => {
        const pct      = Number(b.percent_used) || 0
        const barWidth = clamp(pct, 0, 100)

        return (
          <div key={b.category_id} className="bg-white rounded-xl border border-gray-100 p-4 group hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{b.icon ?? '📦'}</span>
                <span className="text-sm font-medium text-gray-900">{b.category_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${budgetStatusColor(pct)}`}>
                  {pct.toFixed(0)}%
                </span>
                <button
                  onClick={() => openEdit(b)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-700 transition-all"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full transition-all duration-700 ${budgetBarColor(pct)}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Amounts */}
            <div className="flex justify-between text-xs text-gray-500">
              <span>{formatAmount(b.spent, currency)} spent</span>
              <span>{formatAmount(b.remaining >= 0 ? b.remaining : 0, currency)} left of {formatAmount(b.budget_amount, currency)}</span>
            </div>
          </div>
        )
      })}

      {/* Add budget button */}
      <button
        onClick={openAdd}
        className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
      >
        <PlusIcon className="h-4 w-4" />
        Add budget for a category
      </button>

      {/* Add / Edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editBudget ? `Edit budget — ${editBudget.category_name}` : 'Add category budget'}
      >
        <div className="space-y-4">
          {!editBudget && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={catId}
                onChange={(e) => setCatId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
              >
                <option value="">Select a category…</option>
                {availableCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Monthly Budget ({currency})
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 300"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !catId || !amount}
            className="w-full bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save Budget'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
