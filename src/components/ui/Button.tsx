import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The one button of the app. Three semantic variants (no other accent colours for
 * buttons: indigo is reserved for "household variant" semantics) and two sizes.
 *
 *   primary   – main action of a screen or dialog (blue)
 *   secondary – everything else (white with border)
 *   danger    – irreversible actions (red)
 *   ghost     – low-emphasis text button (no border)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-500 disabled:bg-gray-300 dark:disabled:bg-gray-700',
  secondary:
    'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus-visible:ring-blue-500 disabled:text-gray-400 disabled:hover:bg-white dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:disabled:hover:bg-gray-800',
  danger:
    'bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500 disabled:text-red-300 disabled:hover:bg-red-50 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900',
  ghost:
    'text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus-visible:ring-blue-500 disabled:text-gray-400 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
