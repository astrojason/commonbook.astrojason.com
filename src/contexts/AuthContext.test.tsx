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
    const fakeUser = { uid: '123', email: 'test@example.com' } as User
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
})
