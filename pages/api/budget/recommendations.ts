/**
 * pages/api/budget/recommendations.ts
 *
 * POST /api/budget/recommendations
 * Uses OpenAI to suggest budget amounts based on the last 3 months of spending.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase'
import { generateBudgetRecommendations } from '@/lib/openai'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createPagesServerClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  try {
    const now = new Date()

    // Collect last 3 months of spending per category
    const historicalMap: Record<string, number[]> = {}

    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const { data: spending } = await supabaseAdmin
        .from('v_spending_by_category')
        .select('category_type, total_spent')
        .eq('user_id', user.id)
        .eq('year', d.getFullYear())
        .eq('month', d.getMonth() + 1)

      for (const row of spending ?? []) {
        const key = row.category_type as string
        if (!historicalMap[key]) historicalMap[key] = []
        historicalMap[key].push(Number(row.total_spent))
      }
    }

    const historical = Object.entries(historicalMap).map(([category, amounts]) => ({
      category,
      amounts,
    }))

    const recommendations = await generateBudgetRecommendations(historical)

    return res.status(200).json({ recommendations })
  } catch (err: any) {
    console.error('budget recommendations error:', err)
    return res.status(500).json({ error: 'AI recommendations unavailable' })
  }
}
