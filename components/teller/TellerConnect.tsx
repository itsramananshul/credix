/**
 * components/teller/TellerConnect.tsx
 *
 * Teller Connect is loaded via CDN <script> in pages/_app.tsx.
 * The script injects window.TellerConnect on the page.
 *
 * ⚠️  Requires NEXT_PUBLIC_TELLER_APP_ID in your .env.local (and Vercel env vars).
 *     Get it from: https://teller.io/settings/application → Application ID
 *
 * Sandbox test credentials (any values work):
 *   Username: testuser   Password: testpass
 */

import { useCallback } from 'react'
import { BuildingLibraryIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ─── Teller window type ───────────────────────────────────────────────────────
interface TellerAuthorization {
  accessToken: string
  enrollment: {
    id:          string
    institution: { name: string }
  }
  user: { id: string }
}

interface TellerConnectConfig {
  applicationId: string                   // ← Teller uses "applicationId", NOT "appId"
  environment?:  'sandbox' | 'development' | 'production'
  products?:     string[]
  onSuccess:     (authorization: TellerAuthorization) => void
  onExit?:       () => void
  onFailure?:    (err: unknown) => void
}

interface TellerConnectInstance {
  open:    () => void
  destroy: () => void
}

declare global {
  interface Window {
    TellerConnect?: {
      setup: (config: TellerConnectConfig) => TellerConnectInstance
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TellerConnectButtonProps {
  onSuccess?: () => void
  className?: string
}

export function TellerConnectButton({ onSuccess, className }: TellerConnectButtonProps) {

  const handleClick = useCallback(() => {
    // Guard 1: env var missing
    const appId = process.env.NEXT_PUBLIC_TELLER_APP_ID
    if (!appId) {
      toast.error('NEXT_PUBLIC_TELLER_APP_ID is not set. Add it to .env.local and Vercel env vars.')
      console.error('[Credix] Missing NEXT_PUBLIC_TELLER_APP_ID env var')
      return
    }

    // Guard 2: CDN script not loaded yet (very slow connection)
    if (typeof window === 'undefined' || !window.TellerConnect) {
      toast.error('Bank connection is still loading — please try again in a moment')
      return
    }

    let tc: TellerConnectInstance | null = null

    try {
      tc = window.TellerConnect.setup({
        applicationId: appId,             // ← correct key name
        environment:   (process.env.NEXT_PUBLIC_TELLER_ENV ?? 'sandbox') as
                         'sandbox' | 'development' | 'production',
        products:      ['transactions'],

        onSuccess: async (authorization) => {
          const loadingToast = toast.loading(
            `Connecting ${authorization.enrollment.institution.name}…`,
          )
          try {
            const enrollRes = await fetch('/api/teller/enrollment', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                access_token:     authorization.accessToken,
                enrollment_id:    authorization.enrollment.id,
                institution_name: authorization.enrollment.institution.name,
              }),
            })

            if (!enrollRes.ok) {
              const { error } = await enrollRes.json()
              throw new Error(error ?? 'Failed to save enrollment')
            }

            toast.dismiss(loadingToast)
            toast.success(`${authorization.enrollment.institution.name} connected!`)

            // First sync — fire and forget
            fetch('/api/teller/fetch-transactions', { method: 'POST' })
              .then((r) => r.json())
              .then((d) => { if (d.added > 0) toast.success(`Imported ${d.added} transactions`) })
              .catch(() => {})

            onSuccess?.()
          } catch (err: any) {
            toast.dismiss(loadingToast)
            toast.error(err.message ?? 'Failed to connect bank account')
          }
        },

        onExit: () => {},

        onFailure: (err) => {
          console.error('[Teller] connect failure:', err)
          toast.error('Bank connection failed — please try again')
        },
      })

      tc.open()
    } catch (err: any) {
      console.error('[Teller] setup error:', err)
      toast.error('Failed to open bank connection — check your Teller App ID')
    }
  }, [onSuccess])

  return (
    <button
      onClick={handleClick}
      className={
        className ??
        'flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors'
      }
    >
      <BuildingLibraryIcon className="h-4 w-4" />
      Connect a Bank
    </button>
  )
}
