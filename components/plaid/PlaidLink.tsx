/**
 * components/plaid/PlaidLink.tsx
 * Renders the "Connect a bank" button that opens the Plaid Link modal.
 *
 * Flow:
 *  1. On mount, calls /api/plaid/create-link-token → receives link_token
 *  2. usePlaidLink initializes the Plaid Link widget with that token
 *  3. User selects their bank, logs in → Plaid returns a public_token
 *  4. We call /api/plaid/exchange-token with the public_token
 *  5. Backend exchanges it for a permanent access_token and stores it
 *  6. onSuccess callback triggers a transaction sync
 */

import { useCallback, useEffect, useState } from 'react'
import { usePlaidLink, PlaidLinkOptions, PlaidLinkOnSuccess } from 'react-plaid-link'
import { BuildingLibraryIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import type { PlaidLinkSuccessMetadata } from '@/types'

interface PlaidLinkButtonProps {
  onSuccess?: () => void  // called after successful bank connection
  className?: string
}

export function PlaidLinkButton({ onSuccess, className }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: Fetch a link token from our backend when the component mounts
  useEffect(() => {
    async function fetchLinkToken() {
      try {
        const res  = await fetch('/api/plaid/create-link-token', { method: 'POST' })
        const data = await res.json()
        if (data.link_token) {
          setLinkToken(data.link_token)
        } else {
          throw new Error(data.error ?? 'Failed to create link token')
        }
      } catch (err) {
        console.error('PlaidLink: failed to get link token', err)
        toast.error('Failed to initialize bank connection')
      }
    }

    fetchLinkToken()
  }, [])

  // Step 3–5: Called by Plaid after the user successfully links their bank
  const handleSuccess = useCallback<PlaidLinkOnSuccess>(
    async (publicToken, metadata) => {
      setIsLoading(true)
      try {
        // Exchange public token for access token
        const res = await fetch('/api/plaid/exchange-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            public_token:     publicToken,
            institution_id:   metadata.institution.institution_id,
            institution_name: metadata.institution.name,
            accounts:         metadata.accounts,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error)

        toast.success(`${metadata.institution.name} connected!`)

        // Trigger an initial transaction sync
        await fetch('/api/plaid/fetch-transactions', { method: 'POST' })

        onSuccess?.()
      } catch (err) {
        toast.error('Failed to connect bank account')
        console.error('PlaidLink exchange error:', err)
      } finally {
        setIsLoading(false)
      }
    },
    [onSuccess],
  )

  const config: PlaidLinkOptions = {
    token:     linkToken ?? '',
    onSuccess: handleSuccess,
    onExit:    (err) => {
      if (err) toast.error('Bank connection cancelled')
    },
  }

  const { open, ready } = usePlaidLink(config)

  return (
    <button
      onClick={() => open()}
      disabled={!ready || isLoading}
      className={
        className ??
        'flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors'
      }
    >
      <BuildingLibraryIcon className="h-4 w-4" />
      {isLoading ? 'Connecting…' : 'Connect a Bank'}
    </button>
  )
}
