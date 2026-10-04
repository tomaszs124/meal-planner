'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFocusTrap } from './useFocusTrap'

/**
 * App-wide replacement for the browser's `alert()` and `confirm()`.
 *
 *   const { toast, confirm } = useFeedback()
 *   toast('Zapisano', { type: 'success' })
 *   if (!(await confirm({ message: 'Usunąć posiłek?' }))) return
 *
 * Toasts stack at the bottom (above the bottom navigation) and auto-dismiss.
 * `confirm` renders a modal and resolves with the user's choice, so call sites
 * keep the same shape as before (`if (!(await confirm(...))) return`).
 */

export type ToastType = 'info' | 'success' | 'error'

export type ToastOptions = {
  type?: ToastType
  /** Milliseconds before auto-dismiss. Errors stay a bit longer by default. */
  durationMs?: number
}

export type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button for irreversible actions */
  danger?: boolean
}

type FeedbackContextValue = {
  toast: (message: string, options?: ToastOptions) => void
  /**
   * Resolves true (confirm), false (cancel button) or null when the dialog was
   * dismissed with Escape / a click on the backdrop. `if (!(await confirm(...)))`
   * treats null like cancel; check for null explicitly when "dismiss" should abort
   * a flow whose cancel button means "continue without".
   */
  confirm: (options: ConfirmOptions | string) => Promise<boolean | null>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

type ToastItem = { id: number; message: string; type: ToastType; durationMs: number }
type ConfirmResult = boolean | null
type ConfirmState = ConfirmOptions & { resolve: (value: ConfirmResult) => void }

const TOAST_STYLES: Record<ToastType, string> = {
  info: 'bg-gray-900 text-white',
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((message: string, options?: ToastOptions) => {
    const type = options?.type ?? 'info'
    const durationMs = options?.durationMs ?? (type === 'error' ? 6000 : 3500)
    const id = nextId.current++
    setToasts((current) => [...current.slice(-3), { id, message, type, durationMs }])
  }, [])

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof options === 'string' ? { message: options } : options
    return new Promise<ConfirmResult>((resolve) => {
      setConfirmState((previous) => {
        // A second confirm while one is open: dismiss the first so its caller never hangs
        previous?.resolve(null)
        return { ...normalized, resolve }
      })
    })
  }, [])

  const closeConfirm = useCallback(
    (value: ConfirmResult) => {
      confirmState?.resolve(value)
      setConfirmState(null)
    },
    [confirmState]
  )

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm])

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
      {confirmState && <ConfirmDialog state={confirmState} onClose={closeConfirm} />}
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext)
  if (!ctx) {
    throw new Error('useFeedback must be used inside <FeedbackProvider> (see src/app/layout.tsx)')
  }
  return ctx
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[110] flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(item.id), item.durationMs)
    return () => clearTimeout(timer)
  }, [item.id, item.durationMs, onDismiss])

  return (
    <button
      type="button"
      onClick={() => onDismiss(item.id)}
      className={`pointer-events-auto w-full max-w-md rounded-lg px-4 py-3 text-sm shadow-lg text-left ${TOAST_STYLES[item.type]}`}
    >
      {item.message}
    </button>
  )
}

function ConfirmDialog({ state, onClose }: { state: ConfirmState; onClose: (value: ConfirmResult) => void }) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus the confirm button, keep Tab inside, Escape = dismiss, restore focus on close
  useFocusTrap(panelRef, { active: true, onEscape: () => onClose(null), initialFocusRef: confirmRef })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={() => onClose(null)}
    >
      <div
        ref={panelRef}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-base font-semibold text-gray-900">
          {state.title || 'Potwierdź'}
        </h2>
        <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{state.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onClose(false)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {state.cancelLabel || 'Anuluj'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${
              state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {state.confirmLabel || 'OK'}
          </button>
        </div>
      </div>
    </div>
  )
}
