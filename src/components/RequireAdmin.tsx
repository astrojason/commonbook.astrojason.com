import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { isAdminRole } from '../lib/roles'

export function RequireAdmin() {
  const { role } = useAuth()
  if (!isAdminRole(role)) return <Navigate to="/" replace />
  return <Outlet />
}
