/**
 * pages/api/subscriptions/index.ts
 *
 * GET  /api/subscriptions          → list all active subscriptions
 * POST /api/subscriptions          → create a subscription manually
 * PUT  /api/subscriptions?id=xxx   → update a subscription (status, amount, etc.)
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
    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .select('*, category:categories(id, name, icon, color)')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('next_billing_date', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      name, amount, currency = 'USD', frequency, category_id,
      next_billing_date, last_billed_date, is_auto_detected,
      detection_confidence, notes,
    } = req.body

    if (!name || !amount || !frequency) {
      return res.status(400).json({ error: 'name, amount, and frequency are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .insert([{
        user_id: user.id,
        name, amount, currency, frequency, category_id,
        next_billing_date, last_billed_date,
        is_auto_detected:     is_auto_detected ?? false,
        detection_confidence: detection_confidence ?? null,
        notes: notes ?? null,
        status: 'active',
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ data })
  }

  // ── PUT ──────────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id is required' })

    const updates = req.body

    const { data, error } = await supabaseAdmin
      .from('subscriptions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
