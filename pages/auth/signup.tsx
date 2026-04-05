/**
 * pages/auth/signup.tsx
 * Sign-up page — collects name, email, password, and optional student/international flags.
 */

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import toast from 'react-hot-toast'
import { Toaster } from 'react-hot-toast'

export default function SignupPage() {
  const { signUp } = useAuth()

  const [fullName,        setFullName]        = useState('')
  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [isInternational, setIsInternational] = useState(false)
  const [homeCurrency,    setHomeCurrency]    = useState('USD')
  const [loading,         setLoading]         = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    try {
      await signUp(email, password, fullName)

      // Update the profile with international settings after signup
      // (the profile row is auto-created by a Supabase trigger)
      if (isInternational) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('profiles').update({
            is_international: true,
            home_currency:    homeCurrency,
          }).eq('id', user.id)
        }
      }

      toast.success('Account created! Check your email to confirm.')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center p-4">
      <Toaster position="top-center" />

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-primary-500 items-center justify-center mb-3">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 text-sm mt-1">Start tracking your spending today</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Johnson"
              className="input"
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="input"
            />
          </div>

          {/* International student toggle */}
          <div className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              id="intl"
              checked={isInternational}
              onChange={(e) => setIsInternational(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-300"
            />
            <label htmlFor="intl" className="text-sm text-gray-700 cursor-pointer">
              I&apos;m an international student 🌍
            </label>
          </div>

          {/* Home currency selector (shown if international) */}
          {isInternational && (
            <div className="animate-fade-in">
              <label className="label">Home Currency</label>
              <select
                value={homeCurrency}
                onChange={(e) => setHomeCurrency(e.target.value)}
                className="input"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                We&apos;ll show you transactions converted to your home currency.
              </p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-primary-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
