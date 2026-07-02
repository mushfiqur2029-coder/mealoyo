import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// meaLoyo supports three theme modes. 'auto' follows the OS preference at the
// moment it's read (and reacts to live changes — see ThemeProvider). The chosen
// mode is the durable bit; the *resolved* light/dark is derived, never stored.
export type Theme = 'light' | 'dark' | 'auto'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'auto',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'mealoyo-theme',
    },
  ),
)

// Shared helper so the anti-FOUC inline script (in layout.tsx) and the React
// ThemeProvider agree on how a mode resolves to an actual light/dark value.
export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}
