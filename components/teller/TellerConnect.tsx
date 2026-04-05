/**
 * components/teller/TellerConnect.tsx
 *
 * Teller Connect is loaded via a CDN <script> tag (not an npm package).
 * The script adds window.TellerConnect to the page.
 * We call window.TellerConnect.setup() on button click to open the modal.
 *
 * The script is injected once in pages/_app.tsx via next/script.
 *
 * Teller sandbox test credentials (any values work):
 *   Username: testuser   Password: testpass
 */

import { useCallback } from 'react'
import { BuildingLibraryIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

// ─── Teller Connect type declarations ────────────────────────────────────────
// These match the shape of window.TellerConnect injected by the CDN script.
interface TellerAuthorization {
  accessToken: string
  enrollment: {
    id:          string
    institution: { name: string }
  }
  user: { id: string }
}

interface TellerConnectConfig {
  appId:        string
  environment?: 'sandbox' | 'development' | 'production'
  products?:    string[]
  onSuccess:    (authorization: TellerAuthorization) => void
  onExit?:      () => void
  onFailure?:   (err: unknown) => void
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
    // Guard: script may not be loaded yet on very slow connections
    if (typeof window === 'undefined' || !window.TellerConnect) {
      toast.error('Teller is still loading — please try again in a second')
      return
    }

    const tc = window.TellerConnect.setup({
      appId:       process.env.NEXT_PUBLIC_TELLER_APP_ID ?? '',
      environment: (process.env.NEXT_PUBLIC_TELLER_ENV ?? 'sandbox') as 'sandbox' | 'development' | 'production',
      products:    ['transactions'],

      onSuccess: async (authorization) => {
        const loadingToast = toast.loading(
          `Connecting ${authorization.enrollment.institution.name}…`,
        )
        try {
          // Step 1 — store enrollment (access_token saved server-side)
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

          // Step 2 — trigger first transaction sync (fire-and-forget)
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

      onExit: () => {
        // User closed the modal without connecting — no action needed
      },

      onFailure: (err) => {
        console.error('[Teller] connect failure:', err)
        toast.error('Bank connection failed — please try again')
      },
    })

    tc.open()
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
