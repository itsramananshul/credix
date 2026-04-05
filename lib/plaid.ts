/**
 * lib/plaid.ts
 * Initializes and exports the Plaid API client.
 * Used exclusively in API routes (server-side only).
 *
 * Plaid environments:
 *   - 'sandbox'     → fake bank data, free, for development
 *   - 'development' → real bank connections, limited items, for testing
 *   - 'production'  → real bank connections, paid, for launch
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid'

// Map env string to Plaid SDK environment constant
const envMap: Record<string, string> = {
  sandbox:     PlaidEnvironments.sandbox,
  development: PlaidEnvironments.development,
  production:  PlaidEnvironments.production,
}

const plaidEnv = process.env.PLAID_ENV ?? 'sandbox'

const configuration = new Configuration({
  basePath: envMap[plaidEnv] ?? PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
      'PLAID-SECRET':    process.env.PLAID_SECRET!,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse the PLAID_PRODUCTS env var into the Plaid Products enum array.
 * e.g. "transactions,auth" → [Products.Transactions, Products.Auth]
 */
export function getPlaidProducts(): Products[] {
  const raw = process.env.PLAID_PRODUCTS ?? 'transactions'
  return raw.split(',').map((p) => p.trim() as Products)
}

/**
 * Parse the PLAID_COUNTRY_CODES env var into the CountryCode enum array.
 * e.g. "US,CA,GB" → [CountryCode.Us, CountryCode.Ca, CountryCode.Gb]
 */
export function getPlaidCountryCodes(): CountryCode[] {
  const raw = process.env.PLAID_COUNTRY_CODES ?? 'US'
  return raw.split(',').map((c) => c.trim() as CountryCode)
}
