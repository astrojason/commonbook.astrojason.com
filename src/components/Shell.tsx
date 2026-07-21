import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToNotes } from '../lib/notes'
import { isAdminRole } from '../lib/roles'
import { Rule } from './Rule'

const NAV = [
  { label: 'dash',    desktopLabel: 'Dashboard', key: 'D', path: '/',        active: (p: string) => p === '/',                adminOnly: false },
  { label: 'capture', desktopLabel: 'Capture',   key: 'C', path: '/capture', active: (p: string) => p.startsWith('/capture'), adminOnly: false },
  { label: 'note',    desktopLabel: 'Note',       key: 'N', path: null,       active: (p: string) => p.startsWith('/note/'),   adminOnly: false },
  { label: 'session', desktopLabel: 'Session',    key: 'S', path: null,       active: (p: string) => p.startsWith('/session/'), adminOnly: false },
  { label: 'library', desktopLabel: 'Library',    key: 'L', path: '/library',  active: (p: string) => p.startsWith('/library'),  adminOnly: false },
  { label: 'discover', desktopLabel: 'Discover',  key: 'X', path: '/discover', active: (p: string) => p.startsWith('/discover'), adminOnly: false },
  { label: 'settings', desktopLabel: 'Settings',  key: 'T', path: '/settings', active: (p: string) => p.startsWith('/settings'), adminOnly: false },
  { label: 'admin',   desktopLabel: 'Admin',      key: 'A', path: '/admin',    active: (p: string) => p.startsWith('/admin'),    adminOnly: true },
]

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, role } = useAuth()
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    return subscribeToNotes(notes => {
      const now = new Date()
      setDueCount(notes.filter(n => n.next_review_at.toDate() <= now).length)
    }, () => {})
  }, [])

  const visibleNav = NAV.filter(item => !item.adminOnly || isAdminRole(role))
  const currentNav = visibleNav.find(item => item.active(location.pathname))
  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '–'

  return (
    <div className="flex flex-col h-dvh bg-ink max-w-[390px] mx-auto md:flex-row md:max-w-none md:mx-0">

      {/* ── MOBILE: status bar ── */}
      <div className="md:hidden shrink-0 px-5 pt-3 pb-1 flex items-center justify-between font-mono text-[11px] text-muted">
        <span className="invisible select-none">00:00</span>
        <div className="flex items-center gap-2">
          <span>●●●</span>
          <span>commonbook</span>
          <span className="text-accent">▮</span>
        </div>
      </div>

      {/* ── MOBILE: brand bar ── */}
      <div className="md:hidden shrink-0 px-5 pt-1 pb-3 flex items-center justify-between border-b border-rule">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[13px] tracking-[0.2em] uppercase font-medium">commonbook</span>
          <span className="font-mono text-[13px] text-accent">/</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            {currentNav?.label ?? ''}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
          <span>{initials}</span>
          <span className="inline-block w-[14px] h-[14px] border border-rule-2" />
        </div>
      </div>

      {/* ── DESKTOP: sidebar ── */}
      <aside className="hidden md:flex md:w-[220px] md:shrink-0 md:border-r md:border-rule md:flex-col md:bg-ink-2">
        {/* traffic lights + brand */}
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center gap-[7px] mb-6">
            <span className="w-3 h-3 border border-rule-2 rounded-full" />
            <span className="w-3 h-3 border border-rule-2 rounded-full" />
            <span className="w-3 h-3 border border-rule-2 rounded-full" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[15px] tracking-[0.2em] uppercase font-medium">commonbook</span>
            <span className="font-mono text-[15px] text-accent">/</span>
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-dim">knowledge retention</div>
        </div>

        <Rule />

        <nav className="py-3">
          {visibleNav.map(item => {
            const active = item.active(location.pathname)
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={!item.path}
                className="w-full flex items-center gap-3 px-5 py-[10px] text-left relative disabled:cursor-default"
              >
                {active && <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-accent" />}
                <span
                  className="font-mono text-[13px] uppercase tracking-[0.12em]"
                  style={{ color: active ? 'var(--accent)' : 'var(--muted)' }}
                >
                  {item.desktopLabel}
                </span>
                <span className="ml-auto font-mono text-[11px] text-dim">{item.key}</span>
              </button>
            )
          })}
        </nav>

        <Rule />

        {/* due widget */}
        <button
          onClick={() => navigate('/')}
          className="mx-5 mt-5 px-4 py-3 border border-rule hover:border-accent text-left transition-colors group"
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">due now</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-[24px] font-light text-accent">{pad2(dueCount)}</span>
            <span className="font-mono text-[11px] text-muted">notes</span>
          </div>
          <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted group-hover:text-accent transition-colors">
            begin session →
          </div>
        </button>

        <div className="flex-1" />

        <Rule />

        {/* user footer */}
        <div className="px-5 py-4 flex items-center gap-3">
          <span className="w-7 h-7 border border-rule-2 grid place-items-center font-mono text-[12px] text-muted shrink-0">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="font-mono text-[12px] truncate">{user?.displayName ?? '—'}</div>
            <div className="font-mono text-[11px] text-dim">—</div>
          </div>
        </div>

        <div className="px-5 pb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
          v{__APP_VERSION__}
        </div>
      </aside>

      {/* ── BODY ── */}
      {/* Mobile: scrollable wrapper. Desktop: fixed height, pages handle own scroll */}
      <div className="flex-1 overflow-y-auto noscrollbar md:overflow-hidden md:min-w-0 md:flex md:flex-col">
        <Outlet />
      </div>

      {/* ── MOBILE: bottom nav ── */}
      <div className="md:hidden shrink-0 bg-ink border-t border-rule">
        <div className="px-5 py-3 flex items-center justify-between font-mono text-[12px] uppercase tracking-[0.18em]">
          {visibleNav.map(item => {
            const isActive = item.active(location.pathname)
            return (
              <button
                key={item.label}
                onClick={() => item.path && navigate(item.path)}
                disabled={!item.path}
                className={`relative py-1 ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute left-0 right-0 -bottom-3 h-[2px] bg-accent" />
                )}
              </button>
            )
          })}
        </div>
        <div className="text-center font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
          v{__APP_VERSION__}
        </div>
        <div className="h-4" />
      </div>
    </div>
  )
}
