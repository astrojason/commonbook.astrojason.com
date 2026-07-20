import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Admin from './Admin'
import { subscribeToUsers } from '../lib/users'
import { useAuth } from '../contexts/AuthContext'
import type { AppUser } from '../lib/users'
import type { User } from 'firebase/auth'

vi.mock('../lib/users', () => ({ subscribeToUsers: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }))

const getIdToken = vi.fn().mockResolvedValue('caller-token')

function mockSubscribe(users: AppUser[]) {
  vi.mocked(subscribeToUsers).mockImplementation(cb => { cb(users); return () => {} })
}

function makeUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid: 'u1',
    email: 'someone@example.com',
    displayName: 'Someone',
    role: 'PENDING',
    articlesAppUid: null,
    interestKeywords: [],
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getIdToken.mockResolvedValue('caller-token')
  vi.mocked(useAuth).mockReturnValue({
    user: { uid: 'admin-1', getIdToken } as unknown as User,
    role: 'ADMIN',
    loading: false,
    signIn: vi.fn(),
    logOut: vi.fn(),
    refreshRole: vi.fn(),
  })
  global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
})

describe('Admin — display', () => {
  it('lists users with their email and role', () => {
    mockSubscribe([makeUser({ email: 'a@example.com', role: 'PENDING' })])
    render(<Admin />)
    expect(screen.getByText('a@example.com')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('shows a load error when the subscription fails', () => {
    vi.mocked(subscribeToUsers).mockImplementation((_cb, onError) => { onError?.(new Error('BOOM subscribe')); return () => {} })
    render(<Admin />)
    expect(screen.getByText(/BOOM subscribe/)).toBeInTheDocument()
  })

  it('shows an Approve action for a PENDING user', () => {
    mockSubscribe([makeUser({ role: 'PENDING' })])
    render(<Admin />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
  })

  it('shows Promote and Revoke actions for a USER', () => {
    mockSubscribe([makeUser({ role: 'USER' })])
    render(<Admin />)
    expect(screen.getByRole('button', { name: /promote/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
  })

  it('shows a Demote action for an ADMIN', () => {
    mockSubscribe([makeUser({ role: 'ADMIN' })])
    render(<Admin />)
    expect(screen.getByRole('button', { name: /demote/i })).toBeInTheDocument()
  })

  it('shows no role-change controls for SUPERADMIN', () => {
    mockSubscribe([makeUser({ role: 'SUPERADMIN' })])
    render(<Admin />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Admin — role changes', () => {
  it('calls set-role with the caller\'s bearer token when Approve is clicked', async () => {
    mockSubscribe([makeUser({ uid: 'target-1', role: 'PENDING' })])
    render(<Admin />)

    await userEvent.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/set-role', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer caller-token' }),
        body: JSON.stringify({ targetUid: 'target-1', role: 'USER' }),
      }))
    })
  })

  it('shows a copyable error block when the request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'BOOM set-role' }) })
    mockSubscribe([makeUser({ uid: 'target-1', role: 'PENDING' })])
    render(<Admin />)

    await userEvent.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => {
      expect(screen.getByText(/BOOM set-role/)).toBeInTheDocument()
    })
  })
})
