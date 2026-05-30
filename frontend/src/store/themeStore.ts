import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'dark' | 'light'

type State = {
  theme: Theme
  toggle: () => void
  set: (t: Theme) => void
}

export const useThemeStore = create<State>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      toggle: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
        document.documentElement.dataset.theme = next
        set({ theme: next })
      },
      set: (t) => {
        document.documentElement.dataset.theme = t
        set({ theme: t })
      },
    }),
    { name: 'prosports:theme' }
  )
)
