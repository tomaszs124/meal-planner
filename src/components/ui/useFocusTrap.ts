'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Keyboard/focus behaviour shared by the app's modal dialogs.
 *
 *   const dialogRef = useRef<HTMLDivElement>(null)
 *   useFocusTrap(dialogRef, { active: isOpen, onEscape: onClose })
 *   <div ref={dialogRef} role="dialog" aria-modal="true">...</div>
 *
 * While `active`:
 * - focus moves into the container (`initialFocusRef`, else the first focusable
 *   element, else the container itself) unless it is already inside,
 * - Tab / Shift+Tab cycle inside the container (`trapTab: false` disables this for
 *   dialogs whose related controls live outside the container),
 * - Escape calls `onEscape`,
 * - `document.body` scrolling is locked.
 * On deactivate/unmount focus returns to the element that was focused before.
 *
 * Open dialogs form a stack: only the top-most (most recently activated) one reacts
 * to Escape and Tab, so Escape closes one dialog at a time. The scroll lock is
 * reference-counted, so closing a nested dialog keeps the page locked.
 */

export type FocusTrapOptions = {
  active: boolean
  onEscape?: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Keep Tab inside the container (default true). */
  trapTab?: boolean
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.tabIndex >= 0 && el.getClientRects().length > 0
  )
}

// Stack of active traps; the last entry is the top-most dialog
const trapStack: object[] = []

// Reference-counted body scroll lock shared by all traps
let scrollLockCount = 0
let savedBodyOverflow = ''
let savedBodyPaddingRight = ''

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    savedBodyPaddingRight = document.body.style.paddingRight
    // Compensate for the disappearing scrollbar so the page does not shift on desktop
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount++
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow
    document.body.style.paddingRight = savedBodyPaddingRight
  }
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  { active, onEscape, initialFocusRef, trapTab = true }: FocusTrapOptions
) {
  // Latest callbacks/options without re-running the activation effect on every render
  const onEscapeRef = useRef(onEscape)
  const trapTabRef = useRef(trapTab)
  useEffect(() => {
    onEscapeRef.current = onEscape
    trapTabRef.current = trapTab
  })

  useEffect(() => {
    if (!active) return

    const token = {}
    trapStack.push(token)
    const isTop = () => trapStack[trapStack.length - 1] === token

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    lockBodyScroll()

    const container = containerRef.current
    if (container && !container.contains(document.activeElement)) {
      const target = initialFocusRef?.current ?? getFocusable(container)[0]
      if (target) {
        target.focus()
      } else {
        if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
        container.focus()
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (!isTop() || e.defaultPrevented || e.isComposing) return

      if (e.key === 'Escape') {
        onEscapeRef.current?.()
        return
      }

      if (e.key !== 'Tab' || !trapTabRef.current) return
      const root = containerRef.current
      if (!root) return

      const focusable = getFocusable(root)
      if (focusable.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement
      const outside = !root.contains(current)

      if (e.shiftKey && (outside || current === first || current === root)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (outside || current === last)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = trapStack.lastIndexOf(token)
      if (index !== -1) trapStack.splice(index, 1)
      unlockBodyScroll()
      // The opener may have been removed meanwhile (e.g. a deleted row); then leave focus alone
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus()
      }
    }
    // initialFocusRef is read once on activation; refs are stable
  }, [active, containerRef, initialFocusRef])
}
