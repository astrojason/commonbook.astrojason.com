import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV = [
  { label: 'dash',    path: '/',        active: (p: string) => p === '/' },
  { label: 'capture', path: '/capture', active: (p: string) => p.startsWith('/capture') },
  { label: 'note',    path: null,       active: (p: string) => p.startsWith('/note/') },
  { label: 'session', path: null,       active: (p: string) => p.startsWith('/session/') },
  { label: 'library', path: '/library', active: (p: string) => p.startsWith('/library') },
]

export function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const currentNav = NAV.find(item => item.active(location.pathname))
  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '–'

  return (
    <div className="flex flex-col h-dvh bg-ink max-w-[390px] mx-auto">
      {/* status bar */}
      <div className="shrink-0 px-5 pt-3 pb-1 flex items-center justify-between font-mono text-[10px] text-muted">
        <span className="invisible select-none">00:00</span>
        <div className="flex items-center gap-2">
          <span>●●●</span>
          <span>recall</span>
          <span className="text-accent">▮</span>
        </div>
      </div>

      {/* brand bar */}
      <div className="shrink-0 px-5 pt-1 pb-3 flex items-center justify-between border-b border-rule">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[13px] tracking-[0.2em] uppercase font-medium">
            recall
          </span>
          <span className="font-mono text-[13px] text-accent">/</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {currentNav?.label ?? ''}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          <span>{initials}</span>
          <span className="inline-block w-[14px] h-[14px] border border-rule-2" />
        </div>
      </div>

      {/* scrollable body */}
      <div className="flex-1 overflow-y-auto noscrollbar">
        <Outlet />
      </div>

      {/* bottom nav */}
      <div className="shrink-0 bg-ink border-t border-rule">
        <div className="px-5 py-3 flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em]">
          {NAV.map(item => {
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
        <div className="h-4" />
      </div>
    </div>
  )
}
