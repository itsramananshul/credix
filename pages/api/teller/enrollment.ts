/**
 * pages/api/teller/enrollment.ts
 *
 * POST /api/teller/enrollment
 * Body: { access_token, enrollment_id, institution_name }
 *
 * Called right after the user successfully connects a bank via Teller Connect.
 * Saves the access_token (encrypted at rest via Supabase) and fetches
 * the user's accounts from Teller to populate bank_accounts table.
 *
 * SECURITY: access_token is never returned to the client after this point.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase'
import { getAccounts, getBalance } from '@/lib/teller'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Authenticate user via Supabase session
  const supabase = createPagesServerClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  const { access_token, enrollment_id, institution_name } = req.body

  if (!access_token || !enrollment_id) {
    return res.status(400).json({ error: 'access_token and enrollment_id are required' })
  }

  try {
    // ── 1. Save the enrollment (= Plaid "item") ──────────────────────────────
    const { data: enrollment, error: enrollError } = await supabaseAdmin
      .from('plaid_items')         // reusing this table — enrollment_id stored in item_id column
      .upsert(
        {
          user_id:          user.id,
          access_token,              // stored server-side only
          item_id:          enrollment_id,   // Teller enrollment ID
          institution_name: institution_name ?? null,
          status:           'active',
          updated_at:       new Date().toISOString(),
        },
        { onConflict: 'item_id' },
      )
      .select()
      .single()

    if (enrollError) throw enrollError

    // ── 2. Fetch accounts from Teller and upsert into bank_accounts ──────────
    const accounts = await getAccounts(access_token)

    for (const acc of accounts) {
      // Try to fetch balance (non-critical — skip on error)
      let balanceAvailable: number | null = null
      let balanceCurrent:   number | null = null

      try {
        const bal       = await getBalance(access_token, acc.id)
        balanceAvailable = bal.available ? parseFloat(bal.available) : null
        balanceCurrent   = bal.ledger    ? parseFloat(bal.ledger)    : null
      } catch {
        // Balance fetch is best-effort
      }

      await supabaseAdmin.from('bank_accounts').upsert(
        {
          user_id:          user.id,
          plaid_item_id:    enrollment.id,       // FK to our enrollment row
          plaid_account_id: acc.id,              // Teller account ID
          name:             `${acc.institution.name} ${acc.name} ••${acc.last_four}`,
          official_name:    acc.name,
          type:             acc.type,
          subtype:          acc.subtype,
          currency:         acc.currency ?? 'USD',
          balance_available: balanceAvailable,
          balance_current:   balanceCurrent,
          is_active:         acc.status === 'open',
          updated_at:        new Date().toISOString(),
        },
        { onConflict: 'plaid_account_id' },
      )
    }

    return res.status(200).json({ success: true, accounts_imported: accounts.length })
  } catch (err: any) {
    console.error('[Teller] enrollment error:', err?.response?.data ?? err)
    return res.status(500).json({
      error: err?.response?.data?.error?.message ?? err?.message ?? 'Enrollment failed',
    })
  }
}
