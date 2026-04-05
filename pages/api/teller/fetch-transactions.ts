/**
 * pages/api/teller/fetch-transactions.ts
 *
 * POST /api/teller/fetch-transactions
 *
 * Syncs transactions for every active enrollment belonging to the user.
 * For each account:
 *   1. Fetch latest transactions from Teller (up to 500)
 *   2. Normalise amounts (Teller sign → our DB sign)
 *   3. Rule-based categorise → optional AI categorise
 *   4. For international students → convert to home currency
 *   5. Upsert into transactions table (idempotent via teller transaction ID)
 *   6. Update account balances
 *
 * Called:
 *   - Automatically right after enrollment (first sync)
 *   - Manually when user clicks "Sync" on the dashboard / transactions page
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabase'
import {
  getAccounts,
  getTransactions,
  getBalance,
  normaliseTellerAmount,
  mapTellerCategory,
} from '@/lib/teller'
import { categorizeMerchant } from '@/utils/categorize'
import { categorizeTransaction as aiCategorize } from '@/lib/openai'
import { getExchangeRates, convertCurrency } from '@/lib/currency'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = createPagesServerClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  try {
    // ── Load user profile (currency settings) ────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('home_currency, is_international')
      .eq('id', user.id)
      .single()

    // ── Load all active enrollments for this user ────────────────────────────
    const { data: enrollments } = await supabaseAdmin
      .from('plaid_items')       // reusing table — item_id = teller enrollment_id
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (!enrollments || enrollments.length === 0) {
      return res.status(200).json({ added: 0, message: 'No bank accounts connected' })
    }

    // ── Load system categories (category_type → id map) ──────────────────────
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, category_type')
      .eq('is_system', true)

    const categoryMap = new Map(categories?.map((c: any) => [c.category_type, c.id]) ?? [])

    // ── Fetch exchange rates once (only if needed) ───────────────────────────
    let exchangeRates: Record<string, number> = {}
    const needsConversion = profile?.is_international && profile?.home_currency !== 'USD'
    if (needsConversion) {
      exchangeRates = await getExchangeRates('USD')
    }

    let totalAdded = 0

    // ── Process each enrollment ───────────────────────────────────────────────
    for (const enrollment of enrollments) {
      let accounts
      try {
        accounts = await getAccounts(enrollment.access_token)
      } catch (err: any) {
        // If access_token is revoked, mark the enrollment as errored
        if (err?.response?.status === 401) {
          await supabaseAdmin
            .from('plaid_items')
            .update({ status: 'error', error_code: 'token_revoked' })
            .eq('id', enrollment.id)
        }
        continue
      }

      for (const account of accounts) {
        if (account.status !== 'open') continue

        // Find the local bank_accounts row for this Teller account
        const { data: accountRow } = await supabaseAdmin
          .from('bank_accounts')
          .select('id')
          .eq('plaid_account_id', account.id)
          .single()

        // ── Fetch transactions ───────────────────────────────────────────────
        let transactions
        try {
          transactions = await getTransactions(enrollment.access_token, account.id, { count: 500 })
        } catch {
          continue   // skip this account on error, try the next
        }

        // ── Upsert each transaction ──────────────────────────────────────────
        for (const txn of transactions) {
          const merchantName = txn.details?.counterparty?.name ?? txn.description

          // Normalise amount: Teller negative = debit → our positive = debit
          const amount = normaliseTellerAmount(txn.amount)

          // Categorise: Teller category → rule-based fallback → optional AI
          const tellerCat  = mapTellerCategory(txn.details?.category)
          let categoryType = categorizeMerchant(merchantName, [])

          // Only use AI if rule-based gives 'other' and AI key is available
          if (categoryType === 'other' && process.env.OPENAI_API_KEY) {
            try {
              categoryType = (await aiCategorize(merchantName, [txn.details?.category ?? ''])) as any
            } catch {
              // fall back to Teller's own category if AI fails
              categoryType = tellerCat as any
            }
          } else if (categoryType === 'other') {
            categoryType = tellerCat as any
          }

          const categoryId = categoryMap.get(categoryType) ?? categoryMap.get('other')

          // Currency conversion for international students
          let amountHome: number | null   = null
          let rateUsed:   number | null   = null

          if (needsConversion) {
            const currency = account.currency ?? 'USD'
            amountHome = convertCurrency(amount, currency, profile!.home_currency, exchangeRates)
            rateUsed   = exchangeRates[profile!.home_currency] ?? null
          }

          const { error: upsertError } = await supabaseAdmin
            .from('transactions')
            .upsert(
              {
                user_id:              user.id,
                bank_account_id:      accountRow?.id ?? null,
                plaid_transaction_id: txn.id,          // using this column for Teller txn ID
                amount,
                currency:             account.currency ?? 'USD',
                amount_home_currency: amountHome,
                home_currency:        needsConversion ? profile!.home_currency : null,
                exchange_rate_used:   rateUsed,
                name:                 txn.description,
                merchant_name:        txn.details?.counterparty?.name ?? null,
                date:                 txn.date,
                category_id:          categoryId ?? null,
                pending:              txn.status === 'pending',
                plaid_raw:            txn,             // store raw Teller object for debugging
                updated_at:           new Date().toISOString(),
              },
              { onConflict: 'plaid_transaction_id' },
            )

          if (!upsertError) totalAdded++
        }

        // ── Update account balance ───────────────────────────────────────────
        try {
          const bal = await getBalance(enrollment.access_token, account.id)
          await supabaseAdmin
            .from('bank_accounts')
            .update({
              balance_available: bal.available ? parseFloat(bal.available) : null,
              balance_current:   bal.ledger    ? parseFloat(bal.ledger)    : null,
              updated_at:        new Date().toISOString(),
            })
            .eq('plaid_account_id', account.id)
        } catch {
          // Balance update is best-effort
        }
      }
    }

    return res.status(200).json({ added: totalAdded })
  } catch (err: any) {
    console.error('[Teller] fetch-transactions error:', err)
    return res.status(500).json({ error: err?.message ?? 'Failed to fetch transactions' })
  }
}
