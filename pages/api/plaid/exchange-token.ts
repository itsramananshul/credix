/**
 * pages/api/plaid/exchange-token.ts
 *
 * POST /api/plaid/exchange-token
 * Body: { public_token, institution_id, institution_name, accounts }
 *
 * Exchanges the one-time public_token from Plaid Link for a permanent
 * access_token, then stores it + account metadata in Supabase.
 *
 * SECURITY: access_token is stored server-side only, never sent to the browser.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { plaidClient } from '@/lib/plaid'
import { supabaseAdmin } from '@/lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createRouteHandlerClient({ cookies: () => req.cookies as any })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  const { public_token, institution_id, institution_name, accounts } = req.body

  if (!public_token) {
    return res.status(400).json({ error: 'public_token is required' })
  }

  try {
    // Step 1: Exchange public token for access token
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token })
    const { access_token, item_id } = exchangeRes.data

    // Step 2: Store the Plaid item (access_token is sensitive — store server-side only)
    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .upsert(
        {
          user_id:          user.id,
          access_token,     // stored encrypted in DB; never returned to client
          item_id,
          institution_id:   institution_id ?? null,
          institution_name: institution_name ?? null,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'item_id' },
      )
      .select()
      .single()

    if (itemError) throw itemError

    // Step 3: Store each bank account from this item
    const accountInserts = (accounts ?? []).map((acc: any) => ({
      user_id:          user.id,
      plaid_item_id:    plaidItem.id,
      plaid_account_id: acc.id,
      name:             acc.name,
      type:             acc.type,
      subtype:          acc.subtype,
      currency:         'USD',
      is_active:        true,
    }))

    if (accountInserts.length > 0) {
      await supabaseAdmin
        .from('bank_accounts')
        .upsert(accountInserts, { onConflict: 'plaid_account_id' })
    }

    return res.status(200).json({ success: true, item_id })
  } catch (err: any) {
    console.error('Plaid exchangeToken error:', err?.response?.data ?? err)
    return res.status(500).json({
      error: err?.response?.data?.error_message ?? 'Failed to exchange token',
    })
  }
}
