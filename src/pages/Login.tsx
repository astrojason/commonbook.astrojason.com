import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  async function handleSignIn() {
    setError(null)
    try {
      await signIn()
    } catch {
      setError('Sign-in failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-8">
      <h1 className="font-mono text-[var(--text)] text-2xl tracking-widest uppercase">
        commonbook
      </h1>
      <button
        onClick={handleSignIn}
        className="font-mono text-xs uppercase tracking-[0.18em] px-6 py-3 border border-[var(--rule-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors"
      >
        Sign in with Google
      </button>
      {error && (
        <p className="font-mono text-xs text-[var(--accent)] tracking-wider">{error}</p>
      )}
    </div>
  )
}
