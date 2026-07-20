import { render, act } from '@testing-library/react'
import { User, onAuthStateChanged } from 'firebase/auth'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../firebase', () => ({
  auth: {},
  googleProvider: {},
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('../lib/users', () => ({
  ensureUserDoc: vi.fn().mockResolvedValue(undefined),
}))

function AuthConsumer({ spy }: { spy: (v: ReturnType<typeof useAuth>) => void }) {
  spy(useAuth())
  return null
}

describe('AuthContext', () => {
  it('starts with loading=true and user=null before auth resolves', () => {
    vi.mocked(onAuthStateChanged).mockReturnValue(() => {})

    let captured: ReturnType<typeof useAuth> | undefined
    render(
      <AuthProvider>
        <AuthConsumer spy={(v) => { captured = v }} />
      </AuthProvider>
    )

    expect(captured?.loading).toBe(true)
    expect(captured?.user).toBeNull()
  })

  it('exposes user and loading=false after auth state resolves', async () => {
    const fakeUser = {
      uid: '123',
      email: 'test@example.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
    } as unknown as User
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, nextOrObserver) => {
      if (typeof nextOrObserver === 'function') nextOrObserver(fakeUser)
      return () => {}
    })

    let captured: ReturnType<typeof useAuth> | undefined
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer spy={(v) => { captured = v }} />
        </AuthProvider>
      )
    })

    expect(captured?.user).toBe(fakeUser)
    expect(captured?.loading).toBe(false)
  })

  it('exposes role from the ID token custom claims', async () => {
    const fakeUser = {
      uid: '123',
      email: 'test@example.com',
      getIdTokenResult: vi.fn().mockResolvedValue({ claims: { role: 'ADMIN' } }),
    } as unknown as User
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, nextOrObserver) => {
      if (typeof nextOrObserver === 'function') nextOrObserver(fakeUser)
      return () => {}
    })

    let captured: ReturnType<typeof useAuth> | undefined
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer spy={(v) => { captured = v }} />
        </AuthProvider>
      )
    })

    expect(captured?.role).toBe('ADMIN')
  })

  it('exposes role=undefined when signed out', () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, nextOrObserver) => {
      if (typeof nextOrObserver === 'function') nextOrObserver(null)
      return () => {}
    })

    let captured: ReturnType<typeof useAuth> | undefined
    render(
      <AuthProvider>
        <AuthConsumer spy={(v) => { captured = v }} />
      </AuthProvider>
    )

    expect(captured?.role).toBeUndefined()
  })

  it('refreshRole force-refreshes the ID token and updates role', async () => {
    const getIdTokenResult = vi.fn()
      .mockResolvedValueOnce({ claims: {} })
      .mockResolvedValueOnce({ claims: { role: 'USER' } })
    const fakeUser = { uid: '123', email: 'test@example.com', getIdTokenResult } as unknown as User
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, nextOrObserver) => {
      if (typeof nextOrObserver === 'function') nextOrObserver(fakeUser)
      return () => {}
    })

    let captured: ReturnType<typeof useAuth> | undefined
    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer spy={(v) => { captured = v }} />
        </AuthProvider>
      )
    })
    expect(captured?.role).toBeUndefined()

    await act(async () => {
      await captured!.refreshRole()
    })

    expect(captured?.role).toBe('USER')
    expect(getIdTokenResult).toHaveBeenLastCalledWith(true)
  })
})
