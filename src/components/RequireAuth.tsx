import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { hasAppAccess } from '../lib/roles'

export function RequireAuth() {
  const { user, role, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!hasAppAccess(role)) return <PendingApproval />
  return <Outlet />
}

function PendingApproval() {
  const { logOut, refreshRole } = useAuth()

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-mono text-[var(--text)] text-xl tracking-widest uppercase">
        Pending approval
      </h1>
      <p className="font-mono text-xs text-muted max-w-xs leading-relaxed">
        Your account is signed in but hasn't been approved yet. Ask an admin to grant you access, then check again.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => { void refreshRole() }}
          className="font-mono text-xs uppercase tracking-[0.18em] px-4 py-2 border border-[var(--rule-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
        >
          Check again
        </button>
        <button
          onClick={() => { void logOut() }}
          className="font-mono text-xs uppercase tracking-[0.18em] px-4 py-2 border border-[var(--rule-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
