import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastVariant = 'success' | 'error'

interface Toast {
  id: number
  title: string
  detail?: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (title: string, detail?: string, variant?: ToastVariant) => void
}

// Default no-op so components can call useToast() without a provider in the tree
// (e.g. pages rendered directly in tests).
const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

const DISMISS_MS = 4500
const EXIT_MS = 200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [leaving, setLeaving] = useState<Set<number>>(new Set())
  const idRef = useRef(0)

  const remove = useCallback((id: number) => {
    setLeaving(prev => new Set(prev).add(id))
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      setLeaving(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, EXIT_MS)
  }, [])

  const showToast = useCallback((title: string, detail?: string, variant: ToastVariant = 'success') => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, title, detail, variant }])
    setTimeout(() => remove(id), DISMISS_MS)
  }, [remove])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            onClick={() => remove(t.id)}
            className={`pointer-events-auto w-[300px] max-w-full border bg-ink-2 px-4 py-3 cursor-pointer shadow-lg ${leaving.has(t.id) ? 'toast-out' : 'toast-in'}`}
            style={{ borderColor: t.variant === 'error' ? 'var(--accent)' : 'var(--rule-2)' }}
          >
            <div
              className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em]"
              style={{ color: 'var(--accent)' }}
            >
              <span className="inline-block w-[6px] h-[6px] shrink-0 bg-accent" />
              <span className="truncate">{t.title}</span>
            </div>
            {t.detail && (
              <div className="mt-1 font-mono text-[12px] text-muted leading-relaxed break-words">
                {t.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
