/**
 * pages/api/transactions/categorize.ts
 *
 * POST /api/transactions/categorize
 * Body: { transaction_ids?: string[] }  // if omitted, categorize all uncategorized
 *
 * Re-runs categorization on transactions that have no category set yet.
 * Uses AI if OPENAI_API_KEY is set, otherwise rule-based fallback.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase'
import { categorizeMerchant } from '@/utils/categorize'
import { categorizeTransaction as aiCategorize } from '@/lib/openai'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createPagesServerClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  const { transaction_ids } = req.body

  try {
    // Fetch transactions to categorize
    let query = supabaseAdmin
      .from('transactions')
      .select('id, name, merchant_name, plaid_category')
      .eq('user_id', user.id)
      .eq('user_overrode_category', false)

    if (transaction_ids?.length) {
      query = query.in('id', transaction_ids)
    } else {
      query = query.is('category_id', null)  // only uncategorized
    }

    const { data: txns } = await query

    if (!txns || txns.length === 0) {
      return res.status(200).json({ updated: 0 })
    }

    // Fetch category map
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, category_type')
      .eq('is_system', true)

    const categoryMap = new Map(categories?.map((c: any) => [c.category_type, c.id]) ?? [])

    let updated = 0

    for (const txn of txns) {
      const merchant = txn.merchant_name ?? txn.name
      let categoryType: string

      if (process.env.OPENAI_API_KEY) {
        try {
          categoryType = await aiCategorize(merchant, txn.plaid_category ?? [])
        } catch {
          categoryType = categorizeMerchant(merchant, txn.plaid_category ?? [])
        }
      } else {
        categoryType = categorizeMerchant(merchant, txn.plaid_category ?? [])
      }

      const categoryId = categoryMap.get(categoryType)
      if (!categoryId) continue

      await supabaseAdmin
        .from('transactions')
        .update({ category_id: categoryId, updated_at: new Date().toISOString() })
        .eq('id', txn.id)

      updated++
    }

    return res.status(200).json({ updated })
  } catch (err: any) {
    console.error('categorize error:', err)
    return res.status(500).json({ error: 'Failed to categorize transactions' })
  }
}
