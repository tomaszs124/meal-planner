import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The one button of the app. Three semantic variants (no other accent colours for
 * buttons: indigo is reserved for "household variant" semantics) and two sizes.
 * Accent colour is the `brand` scale from src/app/globals.css.
 *
 *   primary   – main action of a screen or dialog (brand gradient with a soft glow)
 *   secondary – everything else (white with border; brand tint on hover)
 *   danger    – irreversible actions (red tint)
 *   ghost     – low-emphasis text button (no border)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-600/30 hover:from-brand-400 hover:to-brand-500 active:from-brand-600 active:to-brand-700 focus-visible:ring-brand-500 disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none dark:disabled:from-gray-700 dark:disabled:to-gray-700',
  secondary:
    'border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50/60 focus-visible:ring-brand-500 disabled:text-gray-400 disabled:shadow-none disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/60 dark:hover:text-brand-300 dark:disabled:hover:border-gray-700 dark:disabled:hover:bg-gray-800',
  danger:
    'bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500 disabled:text-red-300 disabled:hover:bg-red-50 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-brand-500 disabled:text-gray-400 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  fullWidth = false,
  icon,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** Leading icon (16 px SVG) */
  icon?: ReactNode
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
