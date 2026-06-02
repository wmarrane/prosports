import axios from 'axios'

const KEY_TOKEN_LS = 'prosports.key_token'

export function getKeyToken(): string | null {
  return localStorage.getItem(KEY_TOKEN_LS)
}
export function setKeyToken(token: string): void {
  localStorage.setItem(KEY_TOKEN_LS, token)
}
export function clearKeyToken(): void {
  localStorage.removeItem(KEY_TOKEN_LS)
}

const apiKey = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

apiKey.interceptors.request.use((config) => {
  const t = getKeyToken()
  if (t) config.headers.Authorization = `Bearer ${t}`
  return config
})

apiKey.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      clearKeyToken()
      // Mantém rota atual; MobileShell vai detectar ausência de token e mostrar tela de erro
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/e/')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiKey
