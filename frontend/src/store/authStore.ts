import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser, LoginPayload } from '../types/auth'
import api from '../services/api'

type AuthState = {
  user: AuthUser | null
  accessToken: string | null
  loading: boolean
  setAccessToken: (token: string) => void
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      loading: false,

      setAccessToken: (token) => set({ accessToken: token }),

      login: async (payload) => {
        set({ loading: true })
        try {
          const { data } = await api.post<{ accessToken: string; user: AuthUser }>(
            '/auth/login',
            payload
          )
          set({ accessToken: data.accessToken, user: data.user })
        } finally {
          set({ loading: false })
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {
          // ignora erro no logout
        } finally {
          set({ user: null, accessToken: null })
        }
      },
    }),
    {
      name: 'prosports-auth',
      partialize: (s) => ({ user: s.user }),
    }
  )
)
