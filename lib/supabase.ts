/**
 * lib/supabase.ts
 * Exports two Supabase clients:
 *   - `supabase`        — browser client (uses anon key, respects RLS)
 *   - `supabaseAdmin`   — server-only client (uses service role, bypasses RLS)
 *
 * Rule: NEVER import `supabaseAdmin` in any client-side component.
 * Only use it inside /pages/api/* routes where it runs on the server.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe client — obeys Row Level Security
export const supabase = createClient<Database>(supabaseUrl, supabaseAnon)

// Server-only admin client — bypasses RLS (never expose to client!)
// Only available when SUPABASE_SERVICE_ROLE_KEY is set (server env only)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = serviceRoleKey
  ? createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
