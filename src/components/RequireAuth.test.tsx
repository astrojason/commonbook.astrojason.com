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
      loading: false,
      signIn: vi.fn(),
      logOut: vi.fn(),
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

  it('renders protected content when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: '123' } as User,
      loading: false,
      signIn: vi.fn(),
      logOut: vi.fn(),
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
})
