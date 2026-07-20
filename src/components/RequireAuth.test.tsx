import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAuth } from './RequireAuth'
import { useAuth } from '../contexts/AuthContext'
import type { User } from 'firebase/auth'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('RequireAuth', () => {
  it('redirects to /login when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      role: undefined,
      loading: false,
      signIn: vi.fn(),
      logOut: vi.fn(),
      refreshRole: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('renders protected content when authenticated with USER role', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: '123' } as User,
      role: 'USER',
      loading: false,
      signIn: vi.fn(),
      logOut: vi.fn(),
      refreshRole: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Protected')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('renders protected content for ADMIN and SUPERADMIN roles too', () => {
    for (const role of ['ADMIN', 'SUPERADMIN'] as const) {
      vi.mocked(useAuth).mockReturnValue({
        user: { uid: '123' } as User,
        role,
        loading: false,
        signIn: vi.fn(),
        logOut: vi.fn(),
        refreshRole: vi.fn(),
      })

      const { unmount } = render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/login" element={<div>Login page</div>} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<div>Protected</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      )

      expect(screen.getByText('Protected')).toBeInTheDocument()
      unmount()
    }
  })

  it('shows a pending-approval screen (not protected content) when role is PENDING', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: '123' } as User,
      role: 'PENDING',
      loading: false,
      signIn: vi.fn(),
      logOut: vi.fn(),
      refreshRole: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
    expect(screen.getByText(/pending approval/i)).toBeInTheDocument()
  })

  it('shows the pending-approval screen when role is undefined (no claim yet)', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: '123' } as User,
      role: undefined,
      loading: false,
      signIn: vi.fn(),
      logOut: vi.fn(),
      refreshRole: vi.fn(),
    })

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<div>Protected</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
    expect(screen.getByText(/pending approval/i)).toBeInTheDocument()
  })
})
