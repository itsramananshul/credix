/**
 * pages/api/insights.ts
 *
 * POST /api/insights
 * Body: { spending: SpendingByCategory[], budgets: BudgetVsActual[] }
 *
 * Calls OpenAI to generate 3 personalized spending insights.
 * Returns empty array gracefully if OpenAI is not configured.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { generateSpendingInsights } from '@/lib/openai'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createRouteHandlerClient({ cookies: () => req.cookies as any })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  if (!process.env.OPENAI_API_KEY) {
    // No API key — return empty insights instead of erroring
    return res.status(200).json({ insights: [] })
  }

  const { spending = [], budgets = [] } = req.body

  // Build the data structure that OpenAI expects
  const spendingData = spending.map((s: any) => {
    const budget = budgets.find((b: any) => b.category_id === s.category_id)
    return {
      category: s.category_name,
      amount:   Number(s.total_spent),
      budget:   budget ? Number(budget.budget_amount) : 0,
    }
  })

  try {
    // Fetch user profile for context (student type, international, etc.)
    const supabaseAdmin = (await import('@/lib/supabase')).supabaseAdmin
    let userContext = 'college student'

    if (supabaseAdmin) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('student_type, is_international, university')
        .eq('id', user.id)
        .single()

      if (profile) {
        const parts = []
        if (profile.is_international) parts.push('international student')
        if (profile.student_type)     parts.push(profile.student_type + ' student')
        if (profile.university)        parts.push(`at ${profile.university}`)
        if (parts.length) userContext = parts.join(' ')
      }
    }

    const insights = await generateSpendingInsights(spendingData, userContext)
    return res.status(200).json({ insights })
  } catch (err: any) {
    console.error('insights error:', err)
    return res.status(200).json({ insights: [] })  // non-blocking failure
  }
}
