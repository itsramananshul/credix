/**
 * lib/openai.ts
 * OpenAI client + helper functions for:
 *   1. AI-powered transaction categorization
 *   2. Spending insight generation
 *   3. Budget recommendations
 *
 * This file is server-only — never import in browser components.
 * All functions are called from /pages/api/* routes.
 */

import OpenAI from 'openai'

// Lazy-initialize so the app doesn't crash if OPENAI_API_KEY is missing
let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to .env.local to enable AI features.')
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

// ─── Category list sent to GPT so it picks from our schema ──────────────────
const CATEGORY_LIST = [
  'food', 'transport', 'housing', 'education', 'health', 'fitness',
  'entertainment', 'subscriptions', 'shopping', 'travel', 'income',
  'savings', 'utilities', 'personal_care', 'other',
]

/**
 * categorizeTransaction
 * Asks GPT to assign one of our app categories to a transaction.
 *
 * @param merchantName  - cleaned merchant name (e.g. "Whole Foods Market")
 * @param plaidCategory - Plaid's own category array (e.g. ["Food and Drink", "Groceries"])
 * @returns category_type string matching our schema
 */
export async function categorizeTransaction(
  merchantName: string,
  plaidCategory: string[],
): Promise<string> {
  const client = getClient()

  const prompt = `
You are a financial transaction categorizer.

Transaction details:
- Merchant: "${merchantName}"
- Plaid categories: ${JSON.stringify(plaidCategory)}

Choose the single best category from this list:
${CATEGORY_LIST.join(', ')}

Respond with ONLY the category name, nothing else.
`.trim()

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',  // cheap + fast for categorization
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 20,
    temperature: 0,  // deterministic output
  })

  const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? 'other'

  // Validate against our list — fall back to 'other' if GPT hallucinated
  return CATEGORY_LIST.includes(raw) ? raw : 'other'
}

/**
 * generateSpendingInsights
 * Generates a short, personalized spending summary for the dashboard.
 *
 * @param spendingData - Array of { category, amount, budget } objects
 * @param userContext  - Optional context like "international student" or "gym enthusiast"
 * @returns Array of insight strings to display as cards
 */
export async function generateSpendingInsights(
  spendingData: Array<{ category: string; amount: number; budget: number }>,
  userContext = '',
): Promise<string[]> {
  const client = getClient()

  const prompt = `
You are a personal finance advisor helping a ${userContext || 'user'} understand their spending.

Here is their spending this month:
${spendingData.map((d) => `- ${d.category}: spent $${d.amount.toFixed(2)} of $${d.budget.toFixed(2)} budget`).join('\n')}

Give 3 short, actionable, encouraging insights (1-2 sentences each).
Focus on what they're doing well, where they're overspending, and one practical tip.
Respond as a JSON array of strings.
`.trim()

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 300,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  })

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}')
    // GPT may return { insights: [...] } or { tips: [...] } — handle both
    const arr = parsed.insights ?? parsed.tips ?? parsed.recommendations ?? []
    return Array.isArray(arr) ? arr.slice(0, 3) : []
  } catch {
    return ['Keep tracking your spending to see insights here!']
  }
}

/**
 * generateBudgetRecommendations
 * Suggests budget amounts based on past spending patterns.
 *
 * @param historicalSpending - Past 3 months of spending per category
 * @returns Recommended budget amounts per category
 */
export async function generateBudgetRecommendations(
  historicalSpending: Array<{ category: string; amounts: number[] }>,
): Promise<Record<string, number>> {
  const client = getClient()

  const prompt = `
Based on this user's spending over the past 3 months, suggest reasonable monthly budgets.

Historical spending:
${historicalSpending.map((h) => `- ${h.category}: $${h.amounts.join(', $')} (last 3 months)`).join('\n')}

For each category, recommend a budget that is slightly above the average to give flexibility
but discourages overspending.

Respond as a JSON object: { "category_name": recommended_budget_number }
`.trim()

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
    temperature: 0,
    response_format: { type: 'json_object' },
  })

  try {
    return JSON.parse(response.choices[0]?.message?.content ?? '{}')
  } catch {
    return {}
  }
}
