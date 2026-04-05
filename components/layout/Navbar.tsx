/**
 * components/layout/Navbar.tsx
 * Top navigation bar — logo, primary nav links, user avatar menu.
 * Responsive: collapses to mobile hamburger on small screens.
 */

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { clsx } from 'clsx'
import {
  HomeIcon, ArrowsRightLeftIcon, ChartBarIcon,
  CreditCardIcon, Cog6ToothIcon, Bars3Icon, XMarkIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

const NAV_LINKS = [
  { href: '/',              label: 'Dashboard',      icon: HomeIcon               },
  { href: '/transactions',  label: 'Transactions',   icon: ArrowsRightLeftIcon    },
  { href: '/budget',        label: 'Budget',         icon: ChartBarIcon           },
  { href: '/subscriptions', label: 'Subscriptions',  icon: CreditCardIcon         },
  { href: '/settings',      label: 'Settings',       icon: Cog6ToothIcon          },
]

export function Navbar() {
  const router   = useRouter()
  const { user, profile, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    try {
      await signOut()
      router.push('/auth/login')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '?'

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary-500 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-bold text-gray-900 text-lg hidden sm:block">Credix</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = router.pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              )
            })}
          </div>

          {/* User avatar + sign out */}
          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={handleSignOut}
                className="hidden md:block text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-semibold">
              {initials}
            </div>
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <XMarkIcon className="h-5 w-5" /> : <Bars3Icon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 animate-fade-in">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const active = router.pathname === href
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active ? 'bg-primary-50 text-primary-600' : 'text-gray-600 hover:bg-gray-50',
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            )
          })}
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg mt-1"
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  )
}
