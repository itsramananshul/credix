/**
 * lib/teller.ts
 * Teller API client — server-side only, never import in browser components.
 *
 * Teller uses two layers of authentication:
 *   1. mTLS  — every request presents a client certificate (cert + key)
 *   2. Basic — HTTP Basic Auth where username = user's access_token, password = ""
 *
 * The certificate pair is downloaded from: https://teller.io/settings/application
 * Store them as multi-line env vars (newlines encoded as \n) in Vercel.
 *
 * Teller environments:
 *   sandbox     → fake bank data, no real credentials, free — use for dev
 *   development → real bank connections, limited accounts
 *   production  → full production access
 *
 * Teller docs: https://teller.io/docs/api
 */

import https from 'https'
import axios, { AxiosInstance } from 'axios'

const TELLER_API = 'https://api.teller.io'

// ─── Build the mTLS HTTPS agent ───────────────────────────────────────────────
// Certificates are stored as env vars with literal \n for newlines.
// We replace them back to actual newlines before passing to the TLS agent.
function buildTLSAgent(): https.Agent | undefined {
  const cert = process.env.TELLER_CERT?.replace(/\\n/g, '\n')
  const key  = process.env.TELLER_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!cert || !key) {
    // In sandbox with test credentials Teller may not enforce mTLS,
    // but log a warning so the developer knows to add certs before production.
    if (process.env.TELLER_ENV !== 'sandbox') {
      console.warn('[Teller] TELLER_CERT or TELLER_PRIVATE_KEY missing — mTLS disabled')
    }
    return undefined
  }

  return new https.Agent({ cert, key })
}

// Lazy-initialize the agent (certs are only needed server-side at request time)
let _agent: https.Agent | undefined | null = null  // null = not yet initialized

function getAgent(): https.Agent | undefined {
  if (_agent === null) _agent = buildTLSAgent()
  return _agent ?? undefined
}

// ─── Core request helper ──────────────────────────────────────────────────────

/**
 * tellerRequest
 * Makes an authenticated request to the Teller API.
 *
 * @param method      HTTP method
 * @param path        API path, e.g. "/accounts"
 * @param accessToken The enrollment's access_token (per user, per bank connection)
 */
async function tellerRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  accessToken: string,
): Promise<T> {
  const agent = getAgent()

  const response = await axios.request<T>({
    method,
    url:      `${TELLER_API}${path}`,
    // Basic auth: username = access_token, password = "" (empty)
    auth:     { username: accessToken, password: '' },
    // mTLS agent (undefined in sandbox without certs — Teller allows it for sandbox)
    httpsAgent: agent,
    timeout:  15_000,
  })

  return response.data
}

// ─── Teller API wrappers ──────────────────────────────────────────────────────

export interface TellerAccount {
  id:            string
  enrollment_id: string
  name:          string
  currency:      string
  last_four:     string
  status:        'open' | 'closed'
  subtype:       string      // checking | savings | credit_card | mortgage | etc.
  type:          string      // depository | credit | loan
  institution: {
    id:   string
    name: string
  }
  links: {
    balances:     string
    self:         string
    transactions: string
  }
}

export interface TellerBalance {
  account_id: string
  available:  string   // decimal string e.g. "1234.56"
  ledger:     string   // decimal string (= "current" in Plaid terms)
  links: { account: string; self: string }
}

export interface TellerTransaction {
  id:           string
  account_id:   string
  date:         string   // "YYYY-MM-DD"
  description:  string
  // Teller sign convention: NEGATIVE = money out (debit), POSITIVE = money in (credit)
  // This is the OPPOSITE of Plaid's convention.
  amount:       string   // decimal string e.g. "-45.23" for a $45.23 purchase
  status:       'posted' | 'pending'
  type:         string   // card_payment | transfer | ach | atm | etc.
  details: {
    processing_status: string
    category:          string | null  // e.g. "dining", "shopping", "transport"
    counterparty: {
      name: string
      type: 'organization' | 'person'
    } | null
  }
  links: { account: string; self: string }
}

export interface TellerEnrollment {
  id:          string
  institution: { name: string }
  accounts:    TellerAccount[]
}

/** List all accounts for a given enrollment */
export async function getAccounts(accessToken: string): Promise<TellerAccount[]> {
  return tellerRequest<TellerAccount[]>('GET', '/accounts', accessToken)
}

/** Get balance for a specific account */
export async function getBalance(
  accessToken: string,
  accountId: string,
): Promise<TellerBalance> {
  return tellerRequest<TellerBalance>('GET', `/accounts/${accountId}/balances`, accessToken)
}

/**
 * getTransactions
 * Returns up to `count` most recent transactions for an account.
 * Teller doesn't use a cursor — pass `from_id` for pagination.
 */
export async function getTransactions(
  accessToken: string,
  accountId: string,
  options: { count?: number; from_id?: string } = {},
): Promise<TellerTransaction[]> {
  const params = new URLSearchParams()
  if (options.count)   params.set('count',   String(options.count))
  if (options.from_id) params.set('from_id', options.from_id)

  const query = params.toString() ? `?${params}` : ''
  return tellerRequest<TellerTransaction[]>(
    'GET',
    `/accounts/${accountId}/transactions${query}`,
    accessToken,
  )
}

// ─── Amount normalisation ─────────────────────────────────────────────────────

/**
 * normaliseTellerAmount
 * Converts Teller's sign convention to our DB convention.
 *
 * Teller:  negative = debit  (money OUT)  e.g. "-45.23"
 * Our DB:  positive = debit  (money OUT)  (matches how users think about expenses)
 *
 * So we flip the sign: debit "-45.23" → stored as 45.23
 *                      credit "100.0" → stored as -100.00
 */
export function normaliseTellerAmount(tellerAmount: string): number {
  return -(parseFloat(tellerAmount))
}

/** Map Teller category string to our CategoryType */
export function mapTellerCategory(
  tellerCategory: string | null | undefined,
): string {
  if (!tellerCategory) return 'other'

  const map: Record<string, string> = {
    accommodation:       'housing',
    advertising:         'other',
    bar:                 'food',
    charity:             'other',
    clothing:            'shopping',
    dining:              'food',
    education:           'education',
    electronics:         'shopping',
    entertainment:       'entertainment',
    fuel:                'transport',
    groceries:           'food',
    health:              'health',
    home:                'housing',
    income:              'income',
    insurance:           'utilities',
    investment:          'savings',
    loan:                'housing',
    office:              'other',
    phone:               'utilities',
    service:             'utilities',
    shopping:            'shopping',
    software:            'subscriptions',
    sport:               'fitness',
    tax:                 'other',
    transport:           'transport',
    travel:              'travel',
    utilities:           'utilities',
  }

  return map[tellerCategory.toLowerCase()] ?? 'other'
}
