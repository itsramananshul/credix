/**
 * components/layout/Layout.tsx
 * Main page wrapper — renders Navbar + centered page content.
 * Used in pages/_app.tsx to wrap every authenticated page.
 */

import { ReactNode } from 'react'
import { Navbar } from './Navbar'
import { Toaster } from 'react-hot-toast'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      {/* Toast notification container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '12px', background: '#1f2937', color: '#f9fafb', fontSize: '14px' },
        }}
      />
    </div>
  )
}
