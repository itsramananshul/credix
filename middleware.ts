/**
 * middleware.ts
 * Next.js edge middleware — refreshes Supabase auth session on every request.
 * This ensures the session cookie stays fresh without client-side polling.
 *
 * Docs: https://supabase.com/docs/guides/auth/auth-helpers/nextjs
 */

import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Refresh the user's session so it doesn't expire mid-visit
  const supabase = createMiddlewareClient({ req, res })
  await supabase.auth.getSession()

  return res
}

// Run on all routes except static files and API routes that handle their own auth
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
