/**
 * hooks/useSubscriptions.ts
 * Manages active subscriptions and triggers detection.
 */

import useSWR from 'swr'
import { supabase } from '@/lib/supabase'
import type { Subscription } from '@/types'

export function useSubscriptions() {
  const { data, error, isLoading, mutate } = useSWR<Subscription[]>(
    'subscriptions',
    async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, category:categories(id, name, icon, color)')
        .eq('status', 'active')
        .order('next_billing_date', { ascending: true })

      if (error) throw error
      return (data ?? []) as Subscription[]
    },
  )

  async function cancelSubscription(id: string) {
    await supabase.from('subscriptions').update({ status: 'cancelled' }).eq('id', id)
    mutate()
  }

  async function addSubscription(sub: Partial<Subscription>) {
    const { error } = await supabase.from('subscriptions').insert([sub])
    if (error) throw error
    mutate()
  }

  // Total monthly spend across all subscriptions
  const monthlyTotal = (data ?? []).reduce((sum, s) => {
    const monthly = s.frequency === 'monthly'   ? s.amount
                  : s.frequency === 'weekly'    ? s.amount * 4.33
                  : s.frequency === 'quarterly' ? s.amount / 3
                  : s.frequency === 'annual'    ? s.amount / 12
                  : s.amount
    return sum + monthly
  }, 0)

  return { subscriptions: data ?? [], isLoading, error, mutate, cancelSubscription, addSubscription, monthlyTotal }
}
