import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * The one button of the app. Three semantic variants (no other accent colours for
 * buttons: indigo is reserved for "household variant" semantics) and two sizes.
 * Accent colour is the `brand` (saffron) scale from src/app/globals.css.
 *
 *   primary   – main action of a screen or dialog: saffron with ink text
 *   secondary – everything else: paper-white with a hairline, ink text
 *   danger    – irreversible actions: red tint
 *   ghost     – low-emphasis text button (no border)
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md'

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-400 text-gray-950 shadow-sm shadow-brand-500/30 hover:bg-brand-300 active:bg-brand-500 focus-visible:ring-brand-500 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none dark:disabled:bg-gray-700 dark:disabled:text-gray-500',
  secondary:
    'border border-gray-300/80 bg-white text-gray-800 shadow-sm hover:border-gray-900 hover:bg-white focus-visible:ring-brand-500 disabled:text-gray-400 disabled:shadow-none disabled:hover:border-gray-300/80 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-300 dark:hover:bg-gray-800 dark:disabled:hover:border-gray-600',
  danger:
    'bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500 disabled:text-red-300 disabled:hover:bg-red-50 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900',
  ghost:
    'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 focus-visible:ring-brand-500 disabled:text-gray-400 disabled:hover:bg-transparent dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100',
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
