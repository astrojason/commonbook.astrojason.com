import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'
import { ensureUserDoc } from '../lib/users'
import type { Role } from '../lib/roles'

interface AuthContextValue {
  user: User | null
  role: Role | undefined
  loading: boolean
  signIn: () => Promise<void>
  logOut: () => Promise<void>
  refreshRole: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<Role | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await ensureUserDoc(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName)
        const tokenResult = await firebaseUser.getIdTokenResult()
        setRole(tokenResult.claims.role as Role | undefined)
      } else {
        setRole(undefined)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signIn() {
    await signInWithPopup(auth, googleProvider)
  }

  async function logOut() {
    await signOut(auth)
  }

  async function refreshRole() {
    if (!user) return
    const tokenResult = await user.getIdTokenResult(true)
    setRole(tokenResult.claims.role as Role | undefined)
  }

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, logOut, refreshRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
