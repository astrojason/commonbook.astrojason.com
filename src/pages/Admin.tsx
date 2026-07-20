import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToUsers } from '../lib/users'
import type { AppUser } from '../lib/users'

export default function Admin() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pendingUid, setPendingUid] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToUsers(setUsers, err => setLoadError(err.message))
  }, [])

  async function changeRole(targetUid: string, role: string) {
    if (!user) return
    setActionError(null)
    setPendingUid(targetUid)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUid, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || `Request failed (${res.status})`)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingUid(null)
    }
  }

  if (loadError) {
    return (
      <pre role="alert" className="px-5 pt-8 font-mono text-[12px] text-accent whitespace-pre-wrap select-all">
        {loadError}
      </pre>
    )
  }

  return (
    <div className="px-5 py-6">
      <h1 className="font-mono text-[13px] tracking-[0.2em] uppercase font-medium mb-4">Admin</h1>

      {actionError && (
        <pre role="alert" className="mb-4 font-mono text-[12px] text-accent whitespace-pre-wrap select-all border border-accent px-3 py-2">
          {actionError}
        </pre>
      )}

      <p className="font-mono text-[11px] text-dim mb-4">
        After a role change, the affected person needs to sign out and back in (or wait for their session to refresh) before it takes effect.
      </p>

      <ul className="flex flex-col gap-3">
        {users.map(u => (
          <li key={u.uid} className="flex items-center justify-between gap-3 border border-rule px-4 py-3">
            <div className="min-w-0">
              <div className="font-mono text-[13px] truncate">{u.email ?? u.uid}</div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">{u.role}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              {u.role === 'PENDING' && (
                <button
                  onClick={() => changeRole(u.uid, 'USER')}
                  disabled={pendingUid === u.uid}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-1 border border-rule-2 hover:border-accent transition-colors disabled:opacity-50"
                >
                  Approve
                </button>
              )}
              {u.role === 'USER' && (
                <>
                  <button
                    onClick={() => changeRole(u.uid, 'ADMIN')}
                    disabled={pendingUid === u.uid}
                    className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-1 border border-rule-2 hover:border-accent transition-colors disabled:opacity-50"
                  >
                    Promote to admin
                  </button>
                  <button
                    onClick={() => changeRole(u.uid, 'PENDING')}
                    disabled={pendingUid === u.uid}
                    className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-1 border border-rule-2 hover:border-accent transition-colors disabled:opacity-50"
                  >
                    Revoke access
                  </button>
                </>
              )}
              {u.role === 'ADMIN' && (
                <button
                  onClick={() => changeRole(u.uid, 'USER')}
                  disabled={pendingUid === u.uid}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-1 border border-rule-2 hover:border-accent transition-colors disabled:opacity-50"
                >
                  Demote to user
                </button>
              )}
              {u.role === 'SUPERADMIN' && (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">fixed</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
