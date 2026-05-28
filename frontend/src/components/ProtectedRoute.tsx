import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Role } from '../types/auth'

type Props = { roles?: Role[] }

export default function ProtectedRoute({ roles }: Props) {
  const { user, accessToken } = useAuthStore()

  if (!user || !accessToken) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/sem-acesso" replace />

  return <Outlet />
}
