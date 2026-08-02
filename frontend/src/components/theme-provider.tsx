'use client'

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  resolved: 'dark',
  setTheme: () => {},
})

function subscribeToSystemTheme(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'
    return (localStorage.getItem('sem-theme') as Theme | null) ?? 'dark'
  })

  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'dark' as const)
  const resolved: 'light' | 'dark' = theme === 'system' ? systemTheme : theme

  useEffect(() => {
    document.documentElement.className = resolved
  }, [resolved])

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('sem-theme', t)
  }

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
