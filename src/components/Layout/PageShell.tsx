'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The one page container used by every screen, so side gutters and vertical rhythm are
 * identical everywhere (16 px on phones, 24 px from `sm`, 32 px from `lg`).
 * Components rendered inside must NOT add their own max-width / padding wrapper.
 */
export function PageShell({
  children,
  wide = false,
  back = false,
}: {
  children: ReactNode
  /** Dashboard: wider on large screens so the three planner slots fit side by side */
  wide?: boolean
  /** Show the "Wróć" link above the content */
  back?: boolean
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`${wide ? 'max-w-4xl lg:max-w-6xl' : 'max-w-4xl'} mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6`}>
        {back && <BackLink />}
        {children}
      </div>
    </div>
  )
}

/** Title row of a screen: heading, optional subtitle and optional action buttons (wrap below on phones). */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function BackLink() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="-mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Wróć
    </button>
  )
}
