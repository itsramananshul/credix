/**
 * context/AuthContext.tsx
 * Provides authentication state and helpers to the entire app.
 *
 * Wrap your _app.tsx with <AuthProvider> so all pages can call useAuth().
 * Uses Supabase's built-in session management with auto-refresh.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs'
import { User, Session } from '@supabase/supabase-js'
import type { Profile } from '@/types'

// Auth-helpers browser client — stores the session as a cookie so
// createPagesServerClient() in API routes can read it server-side.
const supabase = createPagesBrowserClient()

interface AuthContextValue {
  user:       User | null
  session:    Session | null
  profile:    Profile | null
  isLoading:  boolean
  signUp:     (email: string, password: string, fullName: string) => Promise<void>
  signIn:     (email: string, password: string) => Promise<void>
  signOut:    () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null)
  const [session,   setSession]   = useState<Session | null>(null)
  const [profile,   setProfile]   = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch the profile row for the current user
  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data as Profile | null)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      setIsLoading(false)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id)
  }

  return (
    <AuthContext.Provider
      value={{ user, session, profile, isLoading, signUp, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

/**
 * useAuth — consume auth context in any component.
 * Throws if used outside <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
