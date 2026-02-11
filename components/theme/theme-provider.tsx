'use client'

import React, { useEffect, useState } from 'react'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: 'light' | 'dark' | 'system'
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'theme-preference',
}: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Get the theme preference from localStorage or system preference
    const getTheme = () => {
      const stored = localStorage.getItem(storageKey)
      if (stored) return stored as 'light' | 'dark' | 'system'

      if (defaultTheme !== 'system') return defaultTheme

      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }

    const theme = getTheme()
    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)

    // Apply theme to document
    const html = document.documentElement
    if (isDark) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }

    setMounted(true)
  }, [defaultTheme, storageKey])

  if (!mounted) {
    return <>{children}</>
  }

  return <>{children}</>
}
