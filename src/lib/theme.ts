'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Light / dark theme, chosen in Ustawienia and remembered per device in localStorage.
 * The `dark` class on <html> drives Tailwind's `dark:` variant (see globals.css);
 * `src/app/layout.tsx` applies the stored value before first paint to avoid a flash.
 */
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'meal-planner-theme'
const THEME_COLOR: Record<Theme, string> = { light: '#138066', dark: '#0f172a' }

const listeners = new Set<() => void>()

export function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // private mode: the choice lasts for this page load only
  }
  applyTheme(theme)
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyTheme(readStoredTheme())
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, () => 'light' as Theme)
  const set = useCallback((next: Theme) => setTheme(next), [])
  return [theme, set]
}

/** Inline script for <head>: applies the stored theme before React hydrates. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`
