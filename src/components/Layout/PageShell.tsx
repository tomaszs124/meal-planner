'use client'

import type { ReactNode } from 'react'

/**
 * The one page container used by every screen, so side gutters and vertical rhythm are
 * identical everywhere (16 px on phones, 24 px from `sm`, 32 px from `lg`).
 * Components rendered inside must NOT add their own max-width / padding wrapper.
 */
export function PageShell({
  children,
  wide = false,
}: {
  children: ReactNode
  /** Dashboard: wider on large screens so the three planner slots fit side by side */
  wide?: boolean
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className={`${wide ? 'max-w-4xl lg:max-w-6xl' : 'max-w-4xl'} mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 space-y-4 sm:space-y-6`}>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
