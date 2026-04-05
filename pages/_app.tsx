/**
 * pages/_app.tsx
 * Custom App component — wraps every page with:
 *   - AuthProvider (global auth state)
 *   - Layout (Navbar + page container)
 *   - Global CSS (Tailwind)
 *
 * Auth guard: if the route requires auth and user is not logged in,
 * redirect to /auth/login.
 */

import type { AppProps } from 'next/app'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Script from 'next/script'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Layout } from '@/components/layout/Layout'
import '@/styles/globals.css'

// Routes that don't need auth (shown to unauthenticated users)
const PUBLIC_ROUTES = ['/auth/login', '/auth/signup']

function AppContent({ Component, pageProps }: AppProps) {
  const router  = useRouter()
  const { user, isLoading } = useAuth()

  const isPublic = PUBLIC_ROUTES.includes(router.pathname)

  useEffect(() => {
    if (isLoading) return
    // Redirect unauthenticated users to login (except on public routes)
    if (!user && !isPublic) {
      router.replace('/auth/login')
    }
    // Redirect authenticated users away from auth pages
    if (user && isPublic) {
      router.replace('/')
    }
  }, [user, isLoading, isPublic, router])

  // Show nothing while auth state is loading to prevent flash
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Public pages (login/signup) don't use the Layout
  if (isPublic) {
    return <Component {...pageProps} />
  }

  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}

export default function App(props: AppProps) {
  return (
    <AuthProvider>
      {/* Teller Connect widget — loaded from CDN, adds window.TellerConnect */}
      <Script
        src="https://cdn.teller.io/connect/connect.js"
        strategy="beforeInteractive"
      />
      <AppContent {...props} />
    </AuthProvider>
  )
}
