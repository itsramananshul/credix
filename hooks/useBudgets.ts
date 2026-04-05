/**
 * hooks/useBudgets.ts
 * Fetches budget vs. actual spending for a given month.
 */

import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import type { Budget, BudgetVsActual } from '@/types'

export function useBudgets(year: number, month: number) {
  const { data, error, isLoading, mutate } = useSWR<BudgetVsActual[]>(
    ['budgets', year, month],
    async () => {
      const { data, error } = await supabase
        .from('v_budget_vs_actual')
        .select('*')
        .eq('year', year)
        .eq('month', month)

      if (error) throw error
      return (data ?? []) as BudgetVsActual[]
    },
    { revalidateOnFocus: false },
  )

  async function upsertBudget(
    categoryId: string,
    amount: number,
    currency = 'USD',
  ): Promise<void> {
    const { error } = await supabase.from('budgets').upsert(
      {
        category_id: categoryId,
        year,
        month,
        amount,
        currency,
      },
      { onConflict: 'user_id,category_id,year,month' },
    )
    if (error) throw error
    mutate()
  }

  async function deleteBudget(budgetId: string): Promise<void> {
    const { error } = await supabase.from('budgets').delete().eq('id', budgetId)
    if (error) throw error
    mutate()
  }

  return { budgets: data ?? [], isLoading, error, mutate, upsertBudget, deleteBudget }
}
