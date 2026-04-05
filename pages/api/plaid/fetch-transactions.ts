/**
 * pages/api/plaid/fetch-transactions.ts
 *
 * POST /api/plaid/fetch-transactions
 *
 * Fetches new/modified/removed transactions from Plaid using the
 * Transactions Sync API (cursor-based, incremental updates).
 *
 * For each transaction:
 *  1. Rule-based categorize (fast, free)
 *  2. If OpenAI key exists → AI categorize (more accurate)
 *  3. For international students → add home-currency conversion
 *  4. Upsert into Supabase transactions table
 *  5. Run subscription detection on new transactions
 *
 * Plaid docs: https://plaid.com/docs/transactions/transactions-data/
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { plaidClient } from '@/lib/plaid'
import { supabaseAdmin } from '@/lib/supabase'
import { categorizeMerchant } from '@/utils/categorize'
import { categorizeTransaction as aiCategorize } from '@/lib/openai'
import { getExchangeRates, convertCurrency } from '@/lib/currency'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabase = createRouteHandlerClient({ cookies: () => req.cookies as any })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  if (!supabaseAdmin) return res.status(500).json({ error: 'Server config error' })

  try {
    // Fetch user profile (for home currency)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('home_currency, is_international')
      .eq('id', user.id)
      .single()

    // Fetch all active Plaid items for this user
    const { data: plaidItems } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    if (!plaidItems || plaidItems.length === 0) {
      return res.status(200).json({ added: 0, message: 'No bank accounts connected' })
    }

    // Fetch all categories to map category_type → category_id
    const { data: categories } = await supabaseAdmin
      .from('categories')
      .select('id, category_type')
      .eq('is_system', true)

    const categoryMap = new Map(categories?.map((c: any) => [c.category_type, c.id]) ?? [])

    // Fetch exchange rates once if user is international
    let exchangeRates: Record<string, number> = {}
    if (profile?.is_international && profile.home_currency !== 'USD') {
      exchangeRates = await getExchangeRates('USD')
    }

    let totalAdded    = 0
    let totalModified = 0
    let totalRemoved  = 0

    // Sync each Plaid item
    for (const item of plaidItems) {
      let cursor = item.transaction_cursor
      let hasMore = true

      while (hasMore) {
        const syncRes = await plaidClient.transactionsSync({
          access_token: item.access_token,
          cursor:       cursor ?? undefined,
          count:        500,
        })

        const { added, modified, removed, next_cursor, has_more } = syncRes.data

        // ── Process ADDED transactions ─────────────────────────────────
        for (const txn of added) {
          const merchantName = txn.merchant_name ?? txn.name

          // Rule-based categorization (instant)
          let categoryType = categorizeMerchant(merchantName, txn.category ?? [])

          // AI categorization (better, but optional)
          if (process.env.OPENAI_API_KEY) {
            try {
              categoryType = await aiCategorize(merchantName, txn.category ?? []) as any
            } catch {
              // fall back to rule-based if AI fails
            }
          }

          const categoryId = categoryMap.get(categoryType) ?? categoryMap.get('other')

          // Currency conversion for international students
          let amountHome: number | null    = null
          let homeRateUsed: number | null  = null

          if (profile?.is_international && profile.home_currency !== 'USD' && exchangeRates) {
            amountHome   = convertCurrency(txn.amount, 'USD', profile.home_currency, exchangeRates)
            homeRateUsed = exchangeRates[profile.home_currency] ?? null
          }

          // Find the bank account row for this transaction
          const { data: accountRow } = await supabaseAdmin
            .from('bank_accounts')
            .select('id')
            .eq('plaid_account_id', txn.account_id)
            .single()

          await supabaseAdmin.from('transactions').upsert(
            {
              user_id:              user.id,
              bank_account_id:      accountRow?.id ?? null,
              plaid_transaction_id: txn.transaction_id,
              amount:               txn.amount,
              currency:             txn.iso_currency_code ?? 'USD',
              amount_home_currency: amountHome,
              home_currency:        profile?.is_international ? profile.home_currency : null,
              exchange_rate_used:   homeRateUsed,
              name:                 txn.name,
              merchant_name:        txn.merchant_name ?? null,
              logo_url:             txn.logo_url ?? null,
              date:                 txn.date,
              authorized_date:      txn.authorized_date ?? null,
              category_id:          categoryId ?? null,
              plaid_category:       txn.category ?? null,
              plaid_category_id:    txn.category_id ?? null,
              pending:              txn.pending,
              plaid_raw:            txn,
              updated_at:           new Date().toISOString(),
            },
            { onConflict: 'plaid_transaction_id' },
          )
          totalAdded++
        }

        // ── Process MODIFIED transactions ──────────────────────────────
        for (const txn of modified) {
          await supabaseAdmin.from('transactions')
            .update({
              amount:  txn.amount,
              pending: txn.pending,
              name:    txn.name,
              updated_at: new Date().toISOString(),
            })
            .eq('plaid_transaction_id', txn.transaction_id)
          totalModified++
        }

        // ── Process REMOVED transactions ───────────────────────────────
        for (const rem of removed) {
          await supabaseAdmin.from('transactions')
            .delete()
            .eq('plaid_transaction_id', rem.transaction_id)
          totalRemoved++
        }

        cursor  = next_cursor
        hasMore = has_more
      }

      // Update cursor for next incremental sync
      await supabaseAdmin
        .from('plaid_items')
        .update({ transaction_cursor: cursor, updated_at: new Date().toISOString() })
        .eq('id', item.id)

      // Update account balances
      try {
        const balanceRes = await plaidClient.accountsGet({ access_token: item.access_token })
        for (const acc of balanceRes.data.accounts) {
          await supabaseAdmin
            .from('bank_accounts')
            .update({
              balance_available: acc.balances.available,
              balance_current:   acc.balances.current,
              balance_limit:     acc.balances.limit,
              updated_at:        new Date().toISOString(),
            })
            .eq('plaid_account_id', acc.account_id)
        }
      } catch {
        // Balance update is non-critical — don't fail the whole request
      }
    }

    return res.status(200).json({ added: totalAdded, modified: totalModified, removed: totalRemoved })
  } catch (err: any) {
    console.error('fetchTransactions error:', err?.response?.data ?? err)
    return res.status(500).json({
      error: err?.response?.data?.error_message ?? 'Failed to fetch transactions',
    })
  }
}
