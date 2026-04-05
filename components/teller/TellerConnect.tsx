/**
 * components/teller/TellerConnect.tsx
 * "Connect a bank" button powered by Teller Connect.
 *
 * Flow:
 *  1. User clicks the button → Teller Connect modal opens (Teller's hosted UI)
 *  2. User picks their bank, logs in (sandbox: any credentials work)
 *  3. Teller returns { accessToken, enrollment, user } in onSuccess
 *  4. We POST to /api/teller/enrollment to store the access_token server-side
 *  5. We trigger /api/teller/fetch-transactions for an immediate first sync
 *  6. onSuccess() prop is called to let the parent refresh its data
 *
 * Teller Connect sandbox test credentials:
 *   Username: any string  |  Password: any string
 *   (Pick any bank from the list — all return fake data)
 */

import { useCallback } from 'react'
import { useTellerConnect, TellerConnectOptions } from '@teller-io/react-teller-connect'
import { BuildingLibraryIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

interface TellerConnectButtonProps {
  onSuccess?: () => void   // called after bank is connected + first sync done
  className?: string
}

export function TellerConnectButton({ onSuccess, className }: TellerConnectButtonProps) {
  const handleSuccess = useCallback(
    async (authorization: { accessToken: string; enrollment: { id: string; institution: { name: string } } }) => {
      const loadingToast = toast.loading(`Connecting ${authorization.enrollment.institution.name}…`)
      try {
        // Step 1: Store the enrollment (access_token saved server-side)
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
          const err = await enrollRes.json()
          throw new Error(err.error ?? 'Failed to save enrollment')
        }

        toast.dismiss(loadingToast)
        toast.success(`${authorization.enrollment.institution.name} connected!`)

        // Step 2: Trigger initial transaction sync (non-blocking)
        fetch('/api/teller/fetch-transactions', { method: 'POST' })
          .then((r) => r.json())
          .then((d) => {
            if (d.added > 0) toast.success(`Imported ${d.added} transactions`)
          })
          .catch(() => {})

        onSuccess?.()
      } catch (err: any) {
        toast.dismiss(loadingToast)
        toast.error(err.message ?? 'Failed to connect bank account')
      }
    },
    [onSuccess],
  )

  const config: TellerConnectOptions = {
    appId:       process.env.NEXT_PUBLIC_TELLER_APP_ID ?? '',
    environment: (process.env.NEXT_PUBLIC_TELLER_ENV ?? 'sandbox') as 'sandbox' | 'development' | 'production',
    products:    ['transactions'],   // request transaction access
    onSuccess:   handleSuccess,
    onExit:      () => {},           // user closed the modal without connecting
  }

  const { open, ready } = useTellerConnect(config)

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className={
        className ??
        'flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors'
      }
    >
      <BuildingLibraryIcon className="h-4 w-4" />
      Connect a Bank
    </button>
  )
}
