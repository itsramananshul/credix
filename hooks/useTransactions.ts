/**
 * hooks/useTransactions.ts
 * SWR-based hook for fetching and mutating transactions.
 * Components use this instead of calling the API directly.
 */

import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

interface UseTransactionsOptions {
  year?: number
  month?: number
  categoryId?: string
  limit?: number
}

async function fetchTransactions({
  year,
  month,
  categoryId,
  limit = 100,
}: UseTransactionsOptions): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      category:categories(id, name, icon, color, category_type)
    `)
    .order('date', { ascending: false })
    .limit(limit)

  // Filter by month/year if provided
  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate   = new Date(year, month, 0).toISOString().slice(0, 10)  // last day of month
    query = query.gte('date', startDate).lte('date', endDate)
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId)
  }

  const { data, error } = await query

  if (error) throw error
  return (data ?? []) as Transaction[]
}

export function useTransactions(options: UseTransactionsOptions = {}) {
  const key = ['transactions', options.year, options.month, options.categoryId, options.limit]

  const { data, error, isLoading, mutate } = useSWR<Transaction[]>(
    key,
    () => fetchTransactions(options),
    { revalidateOnFocus: false },
  )

  /**
   * updateCategory — let users override a transaction's category in-place.
   */
  async function updateCategory(transactionId: string, categoryId: string) {
    // Optimistic update
    mutate(
      (prev) =>
        prev?.map((t) =>
          t.id === transactionId
            ? { ...t, category_id: categoryId, user_overrode_category: true }
            : t,
        ),
      false,
    )

    const { error: updateError } = await supabase
      .from('transactions')
      .update({ category_id: categoryId, user_overrode_category: true })
      .eq('id', transactionId)

    if (updateError) {
      mutate()  // revert optimistic update on error
      throw updateError
    }
  }

  /**
   * addNote — save a user note on a transaction.
   */
  async function addNote(transactionId: string, notes: string) {
    await supabase.from('transactions').update({ notes }).eq('id', transactionId)
    mutate()
  }

  return { transactions: data ?? [], isLoading, error, mutate, updateCategory, addNote }
}
