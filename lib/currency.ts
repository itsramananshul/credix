/**
 * lib/currency.ts
 * Currency conversion utilities for international students.
 *
 * Uses the Open Exchange Rates API (or exchangeratesapi.io).
 * Free tier gives you ~1,000 requests/month — enough for most MVPs.
 *
 * Usage: rates are cached in-memory for 1 hour to avoid burning API calls.
 */

// ─── In-memory cache for exchange rates ──────────────────────────────────────
interface RateCache {
  base: string
  rates: Record<string, number>
  fetchedAt: number  // Unix timestamp
}

let rateCache: RateCache | null = null
const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

/**
 * getExchangeRates
 * Fetches current exchange rates from Open Exchange Rates API.
 * Returns cached rates if fresh enough.
 */
export async function getExchangeRates(baseCurrency = 'USD'): Promise<Record<string, number>> {
  const now = Date.now()

  // Return cached rates if they're still fresh
  if (rateCache && rateCache.base === baseCurrency && now - rateCache.fetchedAt < CACHE_TTL_MS) {
    return rateCache.rates
  }

  const apiKey = process.env.EXCHANGE_RATES_API_KEY

  if (!apiKey) {
    console.warn('EXCHANGE_RATES_API_KEY not set — returning identity rates')
    // Return 1:1 rates so the app doesn't crash when key is missing
    return { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.1, CAD: 1.36, AUD: 1.53, NGN: 1580, CNY: 7.24 }
  }

  try {
    // Open Exchange Rates endpoint (base=USD always on free tier)
    const res = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=USD`,
    )
    const data = await res.json()

    let rates: Record<string, number> = data.rates

    // If user's base isn't USD, recalculate relative to their base
    if (baseCurrency !== 'USD' && rates[baseCurrency]) {
      const baseRate = rates[baseCurrency]
      rates = Object.fromEntries(
        Object.entries(rates).map(([code, rate]) => [code, rate / baseRate]),
      )
    }

    rateCache = { base: baseCurrency, rates, fetchedAt: now }
    return rates
  } catch (err) {
    console.error('Failed to fetch exchange rates:', err)
    return rateCache?.rates ?? { USD: 1 }
  }
}

/**
 * convertCurrency
 * Converts an amount from one currency to another.
 *
 * @example
 * convertCurrency(100, 'USD', 'INR', rates)  // → 8310
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount

  // Convert to USD first (our base), then to target
  const fromRate = rates[fromCurrency] ?? 1
  const toRate   = rates[toCurrency]   ?? 1

  return (amount / fromRate) * toRate
}

/**
 * formatCurrency
 * Formats a number as a localized currency string.
 *
 * @example
 * formatCurrency(1234.56, 'USD')  // → "$1,234.56"
 * formatCurrency(1234.56, 'INR')  // → "₹1,234.56"
 */
export function formatCurrency(amount: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style:    'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * getCurrencySymbol
 * Returns the symbol for a given ISO 4217 currency code.
 */
export function getCurrencySymbol(currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? currency
}

// Common currencies with display names for the settings dropdown
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar',         symbol: '$'  },
  { code: 'EUR', name: 'Euro',               symbol: '€'  },
  { code: 'GBP', name: 'British Pound',      symbol: '£'  },
  { code: 'CAD', name: 'Canadian Dollar',    symbol: 'CA$'},
  { code: 'AUD', name: 'Australian Dollar',  symbol: 'A$' },
  { code: 'INR', name: 'Indian Rupee',       symbol: '₹'  },
  { code: 'CNY', name: 'Chinese Yuan',       symbol: '¥'  },
  { code: 'NGN', name: 'Nigerian Naira',     symbol: '₦'  },
  { code: 'GHS', name: 'Ghanaian Cedi',      symbol: 'GH₵'},
  { code: 'KES', name: 'Kenyan Shilling',    symbol: 'KSh'},
  { code: 'BRL', name: 'Brazilian Real',     symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso',       symbol: 'MX$'},
  { code: 'JPY', name: 'Japanese Yen',       symbol: '¥'  },
  { code: 'KRW', name: 'South Korean Won',   symbol: '₩'  },
  { code: 'PKR', name: 'Pakistani Rupee',    symbol: '₨'  },
  { code: 'BDT', name: 'Bangladeshi Taka',   symbol: '৳'  },
]
