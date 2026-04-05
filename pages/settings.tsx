/**
 * pages/settings.tsx — Account & Settings Page
 *
 * Sections:
 *  1. Profile (name, university, student type)
 *  2. International student (home currency toggle)
 *  3. Connected bank accounts (list + disconnect)
 *  4. Notifications preferences
 */

import { useState, FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { PlaidLinkButton } from '@/components/plaid/PlaidLink'
import { Card } from '@/components/ui/Card'
import { SUPPORTED_CURRENCIES } from '@/lib/currency'
import type { BankAccount } from '@/types'
import useSWR from 'swr'
import toast from 'react-hot-toast'
import { TrashIcon } from '@heroicons/react/24/outline'

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth()

  const [fullName,        setFullName]        = useState(profile?.full_name ?? '')
  const [university,      setUniversity]      = useState(profile?.university ?? '')
  const [studentType,     setStudentType]     = useState(profile?.student_type ?? '')
  const [isInternational, setIsInternational] = useState(profile?.is_international ?? false)
  const [homeCurrency,    setHomeCurrency]    = useState(profile?.home_currency ?? 'USD')
  const [savingProfile,   setSavingProfile]   = useState(false)

  const { data: accounts = [], mutate: refetchAccounts } = useSWR<BankAccount[]>(
    'bank_accounts',
    async () => {
      const { data } = await supabase.from('bank_accounts').select('*').order('name')
      return (data ?? []) as BankAccount[]
    },
  )

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('profiles').update({
        full_name:        fullName,
        university,
        student_type:     studentType || null,
        is_international: isInternational,
        home_currency:    homeCurrency,
        updated_at:       new Date().toISOString(),
      }).eq('id', profile!.id)

      if (error) throw error
      await refreshProfile()
      toast.success('Profile saved')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save')
    } finally {
      setSavingProfile(false)
    }
  }

  async function disconnectAccount(accountId: string) {
    if (!confirm('Disconnect this account? Existing transactions will be kept.')) return
    await supabase.from('bank_accounts').update({ is_active: false }).eq('id', accountId)
    refetchAccounts()
    toast.success('Account disconnected')
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-2xl">
      <div>
        <h1 className="page-title">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your profile and preferences</p>
      </div>

      {/* ── Profile ────────────────────────────────────────────────────── */}
      <Card title="Profile">
        <form onSubmit={saveProfile} className="space-y-4 mt-2">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              placeholder="Alex Johnson"
            />
          </div>

          <div>
            <label className="label">University / School</label>
            <input
              type="text"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="input"
              placeholder="e.g. University of Michigan"
            />
          </div>

          <div>
            <label className="label">Student Type</label>
            <select
              value={studentType}
              onChange={(e) => setStudentType(e.target.value)}
              className="input"
            >
              <option value="">Select…</option>
              <option value="undergraduate">Undergraduate</option>
              <option value="graduate">Graduate</option>
              <option value="phd">PhD</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* ── International settings ───────────────────────────────── */}
          <div className="pt-2 border-t border-gray-50">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="intl"
                checked={isInternational}
                onChange={(e) => setIsInternational(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-500"
              />
              <label htmlFor="intl" className="text-sm font-medium text-gray-700 cursor-pointer">
                International student 🌍
              </label>
            </div>

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
                  Transactions will show an equivalent amount in {homeCurrency}.
                </p>
              </div>
            )}
          </div>

          <button type="submit" disabled={savingProfile} className="btn-primary">
            {savingProfile ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </Card>

      {/* ── Connected bank accounts ───────────────────────────────────── */}
      <Card
        title="Connected Accounts"
        action={<PlaidLinkButton onSuccess={refetchAccounts} />}
      >
        {accounts.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">No accounts connected yet.</p>
        ) : (
          <div className="space-y-2 mt-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{acc.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{acc.subtype} · {acc.currency}</p>
                </div>
                <button
                  onClick={() => disconnectAccount(acc.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Disconnect account"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
