/**
 * lib/supabase.ts
 * Exports two Supabase clients:
 *   - `supabase`      — browser client (uses anon key, respects RLS)
 *   - `supabaseAdmin` — server-only client (uses service role, bypasses RLS)
 *
 * Rule: NEVER import `supabaseAdmin` in any client-side component.
 * Only use it inside /pages/api/* routes where it runs on the server.
 *
 * Note: we intentionally omit the <Database> generic here because our
 * hand-written Database stub only carries Row types, not Insert/Update types.
 * Supabase would infer `never` for mutations, breaking upsert/insert calls.
 * Full generated types (via `supabase gen types typescript`) can be swapped in
 * later once you want end-to-end type safety.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe client — obeys Row Level Security
export const supabase = createClient(supabaseUrl, supabaseAnon)

// Server-only admin client — bypasses RLS (never expose to client!)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
