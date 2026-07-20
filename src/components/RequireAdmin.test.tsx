import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAdmin } from './RequireAdmin'
import { useAuth } from '../contexts/AuthContext'
import type { User } from 'firebase/auth'

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

function renderWithRole(role: string | undefined) {
  vi.mocked(useAuth).mockReturnValue({
    user: { uid: '123' } as User,
    role: role as never,
    loading: false,
    signIn: vi.fn(),
    logOut: vi.fn(),
    refreshRole: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/" element={<div>home page</div>} />
        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<div>Admin page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('RequireAdmin', () => {
  it('redirects USER to /', () => {
    renderWithRole('USER')
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument()
    expect(screen.getByText('home page')).toBeInTheDocument()
  })

  it('redirects PENDING to /', () => {
    renderWithRole('PENDING')
    expect(screen.queryByText('Admin page')).not.toBeInTheDocument()
  })

  it('allows ADMIN', () => {
    renderWithRole('ADMIN')
    expect(screen.getByText('Admin page')).toBeInTheDocument()
  })

  it('allows SUPERADMIN', () => {
    renderWithRole('SUPERADMIN')
    expect(screen.getByText('Admin page')).toBeInTheDocument()
  })
})
