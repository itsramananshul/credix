/**
 * pages/api/budget/index.ts
 *
 * GET  /api/budget?year=2024&month=3   → fetch budgets + actuals for a month
 * POST /api/budget                     → create or update a budget
 * Body: { category_id, year, month, amount, currency? }
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createRouteHandlerClient({ cookies: () => req.cookies as any })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { year, month } = req.query

    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('v_budget_vs_actual')
      .select('*')
      .eq('user_id', user.id)
      .eq('year', Number(year))
      .eq('month', Number(month))

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { category_id, year, month, amount, currency = 'USD' } = req.body

    if (!category_id || !year || !month || amount === undefined) {
      return res.status(400).json({ error: 'category_id, year, month, and amount are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('budgets')
      .upsert(
        {
          user_id: user.id,
          category_id,
          year:    Number(year),
          month:   Number(month),
          amount:  Number(amount),
          currency,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category_id,year,month' },
      )
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
