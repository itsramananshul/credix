/**
 * pages/api/plaid/create-link-token.ts
 *
 * POST /api/plaid/create-link-token
 * Creates a Plaid Link token for the authenticated user.
 * The frontend uses this token to initialize the Plaid Link widget.
 *
 * Plaid docs: https://plaid.com/docs/api/tokens/#linktokencreate
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { plaidClient, getPlaidProducts, getPlaidCountryCodes } from '@/lib/plaid'
import { CountryCode, Products } from 'plaid'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Authenticate the user via Supabase session cookie
  const supabase = createRouteHandlerClient({ cookies: () => req.cookies as any })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: user.id,  // Plaid uses this to associate the link with your user
      },
      client_name:   'Credix',
      products:       getPlaidProducts(),
      country_codes:  getPlaidCountryCodes(),
      language:      'en',
      // Uncomment to enable OAuth (required for some banks):
      // redirect_uri: process.env.PLAID_REDIRECT_URI,
    })

    return res.status(200).json({ link_token: response.data.link_token })
  } catch (err: any) {
    console.error('Plaid createLinkToken error:', err?.response?.data ?? err)
    return res.status(500).json({
      error: err?.response?.data?.error_message ?? 'Failed to create link token',
    })
  }
}
