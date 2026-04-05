/**
 * utils/categorize.ts
 * Rule-based transaction categorizer (fast, free, no API call).
 *
 * Used as the PRIMARY categorizer when OpenAI is not configured,
 * or as a pre-filter before sending to AI to save tokens.
 *
 * Logic: match merchant name against keyword lists → return category_type.
 */

import type { CategoryType } from '@/types'

// ─── Keyword → Category mapping ──────────────────────────────────────────────
// Keys are lowercase substrings to match against merchant name.
// Order matters — earlier rules take priority on ambiguous merchants.
const KEYWORD_RULES: Array<{ keywords: string[]; category: CategoryType }> = [
  // Education (check before food — some campuses have café names)
  {
    category: 'education',
    keywords: [
      'tuition', 'university', 'college', 'coursera', 'udemy', 'udacity',
      'chegg', 'pearson', 'mcgraw', 'blackboard', 'canvas lms', 'textbook',
      'student loan', 'fasfa', 'scholarship', 'campus store',
    ],
  },
  // Fitness & Gym
  {
    category: 'fitness',
    keywords: [
      'planet fitness', 'la fitness', 'anytime fitness', 'equinox', 'ymca',
      'gold\'s gym', '24 hour fitness', 'crunch', 'orange theory', 'f45',
      'crossfit', 'peloton', 'myfitnesspal', 'beachbody', 'nike training',
      'gnc', 'vitamin shoppe', 'supplement', 'protein', 'gym',
    ],
  },
  // Subscriptions (check before entertainment)
  {
    category: 'subscriptions',
    keywords: [
      'netflix', 'spotify', 'apple music', 'hulu', 'disney+', 'hbo max',
      'amazon prime', 'youtube premium', 'twitch', 'patreon', 'substack',
      'microsoft 365', 'adobe', 'dropbox', 'icloud', 'google one',
      'notion', 'slack', 'zoom', 'github', 'vercel', 'aws',
    ],
  },
  // Food & Dining
  {
    category: 'food',
    keywords: [
      'doordash', 'uber eats', 'grubhub', 'instacart', 'chipotle',
      'mcdonald', 'starbucks', 'subway', 'domino', 'pizza hut', 'wendy\'s',
      'taco bell', 'dunkin', 'panera', 'chick-fil-a', 'whole foods',
      'kroger', 'safeway', 'trader joe', 'walmart grocery', 'costco food',
      'restaurant', 'cafe', 'coffee', 'bakery', 'sushi', 'thai', 'chinese',
      'diner', 'grill', 'burger', 'wings', 'taqueria', 'dining',
    ],
  },
  // Transport
  {
    category: 'transport',
    keywords: [
      'uber', 'lyft', 'taxi', 'metro', 'transit', 'bus', 'amtrak',
      'greyhound', 'delta', 'southwest', 'american airlines', 'united air',
      'frontier', 'spirit air', 'jetblue', 'mta', 'bart', 'cta',
      'parking', 'shell', 'bp gas', 'exxon', 'chevron', 'sunoco',
      'gas station', 'enterprise rent', 'hertz', 'avis', 'zipcar',
    ],
  },
  // Housing
  {
    category: 'housing',
    keywords: [
      'rent', 'apartment', 'zillow', 'apartments.com', 'leasing',
      'property management', 'landlord', 'hoa', 'mortgage', 'home depot',
      'lowes', 'ikea', 'bed bath', 'wayfair', 'furniture',
    ],
  },
  // Health & Medical
  {
    category: 'health',
    keywords: [
      'cvs', 'walgreens', 'rite aid', 'pharmacy', 'medical', 'doctor',
      'dentist', 'hospital', 'urgent care', 'mental health', 'therapy',
      'optometrist', 'health insurance', 'blue cross', 'aetna', 'cigna',
      'prescription', 'clinic', 'lab corp', 'quest diagnostics',
    ],
  },
  // Entertainment
  {
    category: 'entertainment',
    keywords: [
      'amc theatre', 'regal cinema', 'imax', 'cinemark', 'movie',
      'concert', 'ticketmaster', 'stubhub', 'eventbrite', 'bowling',
      'dave & buster', 'escape room', 'trampoline', 'topgolf',
      'gamestop', 'steam', 'xbox', 'playstation', 'nintendo',
    ],
  },
  // Shopping
  {
    category: 'shopping',
    keywords: [
      'amazon', 'ebay', 'etsy', 'target', 'walmart', 'best buy',
      'apple store', 'macy\'s', 'nordstrom', 'gap', 'h&m', 'zara',
      'old navy', 'forever 21', 'urban outfitters', 'tj maxx', 'marshalls',
    ],
  },
  // Utilities
  {
    category: 'utilities',
    keywords: [
      'electric', 'water bill', 'gas bill', 'pge', 'con ed', 'verizon',
      'at&t', 't-mobile', 'comcast', 'spectrum', 'xfinity', 'internet',
      'phone bill', 'utility', 'sewage',
    ],
  },
  // Personal Care
  {
    category: 'personal_care',
    keywords: [
      'supercuts', 'great clips', 'hair salon', 'barbershop', 'nail salon',
      'spa', 'massage', 'ulta', 'sephora', 'beauty supply', 'laundry',
      'dry clean', 'coinstar',
    ],
  },
  // Travel
  {
    category: 'travel',
    keywords: [
      'hotel', 'airbnb', 'vrbo', 'marriott', 'hilton', 'hyatt', 'expedia',
      'booking.com', 'trivago', 'kayak', 'cruise', 'resort', 'hostel',
    ],
  },
  // Income (credits to account)
  {
    category: 'income',
    keywords: [
      'payroll', 'direct deposit', 'salary', 'wages', 'venmo', 'zelle',
      'cashapp', 'payment received', 'refund', 'tax refund', 'financial aid',
    ],
  },
]

/**
 * categorizeMerchant
 * Fast rule-based categorizer — O(n*m) but n and m are both small.
 * Returns a CategoryType string.
 */
export function categorizeMerchant(merchantName: string, plaidCategories?: string[]): CategoryType {
  const lowerMerchant = merchantName.toLowerCase()

  // Check merchant name against keyword rules
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lowerMerchant.includes(kw))) {
      return rule.category
    }
  }

  // Fall back to Plaid's own category if available
  if (plaidCategories && plaidCategories.length > 0) {
    return mapPlaidCategory(plaidCategories)
  }

  return 'other'
}

/**
 * mapPlaidCategory
 * Maps Plaid's category hierarchy to our app's category types.
 * Plaid returns an array like ["Food and Drink", "Restaurants", "Fast Food"]
 */
function mapPlaidCategory(plaidCats: string[]): CategoryType {
  const top = (plaidCats[0] ?? '').toLowerCase()
  const sub = (plaidCats[1] ?? '').toLowerCase()

  if (top.includes('food') || top.includes('restaurant')) return 'food'
  if (top.includes('travel') || sub.includes('airlines')) return 'travel'
  if (top.includes('transportation'))                      return 'transport'
  if (top.includes('shops'))                               return 'shopping'
  if (top.includes('recreation') || sub.includes('gym'))   return 'fitness'
  if (top.includes('healthcare') || top.includes('medical')) return 'health'
  if (top.includes('payment') || sub.includes('rent'))    return 'housing'
  if (top.includes('service') && sub.includes('internet')) return 'utilities'
  if (top.includes('transfer') && sub.includes('deposit')) return 'income'

  return 'other'
}

/**
 * detectSubscription
 * Heuristic to decide if a transaction looks like a subscription charge.
 * Returns confidence score 0.0–1.0.
 */
export function detectSubscription(
  merchantName: string,
  amount: number,
  recentTransactions: Array<{ merchant_name: string | null; amount: number; date: string }>,
): { isSubscription: boolean; confidence: number } {
  const lowerName = merchantName.toLowerCase()

  // Check against known subscription services
  const knownSubs = [
    'netflix', 'spotify', 'hulu', 'disney', 'amazon prime', 'youtube',
    'apple', 'google', 'microsoft', 'adobe', 'dropbox', 'notion',
    'gym', 'fitness', 'planet fitness', 'equinox',
  ]

  const isKnown = knownSubs.some((s) => lowerName.includes(s))

  // Check for recurring pattern in past transactions (same merchant, similar amount)
  const similarPast = recentTransactions.filter(
    (t) =>
      t.merchant_name?.toLowerCase().includes(lowerName.split(' ')[0]) &&
      Math.abs(t.amount - amount) < 1.0,  // within $1
  )

  const hasPattern = similarPast.length >= 2

  if (isKnown && hasPattern) return { isSubscription: true,  confidence: 0.97 }
  if (isKnown)               return { isSubscription: true,  confidence: 0.80 }
  if (hasPattern)            return { isSubscription: true,  confidence: 0.70 }

  return { isSubscription: false, confidence: 0.0 }
}
