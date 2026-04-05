/**
 * pages/api/user/index.ts
 *
 * GET /api/user → returns the current user's profile + account balances
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createRouteHandlerClient({ cookies: () => req.cookies as any })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  const [{ data: profile }, { data: accounts }] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', user.id).single(),
    supabaseAdmin
      .from('bank_accounts')
      .select('name, subtype, currency, balance_current, balance_available')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  const totalBalance = (accounts ?? []).reduce(
    (sum: number, a: any) => sum + (a.balance_current ?? 0),
    0,
  )

  return res.status(200).json({
    profile,
    accounts,
    totalBalance,
  })
}
