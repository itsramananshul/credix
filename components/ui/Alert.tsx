/**
 * components/ui/Alert.tsx
 * Inline alert banners for budget warnings, subscription alerts, etc.
 */

import { ReactNode } from 'react'
import { clsx } from 'clsx'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import type { AlertVariant } from '@/types'

interface AlertProps {
  variant?:   AlertVariant
  title?:     string
  children:   ReactNode
  onDismiss?: () => void
  className?: string
}

const config: Record<AlertVariant, { bg: string; border: string; text: string; icon: typeof CheckCircleIcon }> = {
  success: { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-800',  icon: CheckCircleIcon          },
  warning: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: ExclamationTriangleIcon  },
  danger:  { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-800',    icon: XCircleIcon              },
  info:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   icon: InformationCircleIcon    },
}

export function Alert({ variant = 'info', title, children, onDismiss, className }: AlertProps) {
  const { bg, border, text, icon: Icon } = config[variant]

  return (
    <div className={clsx('flex gap-3 p-4 rounded-xl border', bg, border, className)}>
      <Icon className={clsx('h-5 w-5 shrink-0 mt-0.5', text)} />
      <div className={clsx('flex-1 text-sm', text)}>
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={clsx('shrink-0 rounded p-0.5 hover:bg-black/10 transition-colors', text)}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
