/**
 * components/ui/Card.tsx
 * Reusable card container with optional title, subtitle, and action slot.
 */

import { ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children:   ReactNode
  title?:     string
  subtitle?:  string
  action?:    ReactNode  // e.g. a "View all" link
  className?: string
  padding?:   boolean
}

export function Card({ children, title, subtitle, action, className, padding = true }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-gray-100 shadow-sm',
        padding && 'p-5',
        className,
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title    && <h3 className="text-sm font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  )
}
