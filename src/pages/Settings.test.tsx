import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Settings from './Settings'
import { subscribeToUser, updateUserSettings } from '../lib/users'
import { useAuth } from '../contexts/AuthContext'
import type { AppUser } from '../lib/users'
import type { User } from 'firebase/auth'

vi.mock('../lib/users', () => ({
  subscribeToUser: vi.fn(),
  updateUserSettings: vi.fn(),
}))
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }))

function makeAppUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid: 'u1',
    email: 'me@example.com',
    displayName: 'Me',
    role: 'USER',
    articlesAppUid: null,
    interestKeywords: [],
    ...overrides,
  }
}

function mockSubscribe(appUser: AppUser | null) {
  vi.mocked(subscribeToUser).mockImplementation((_uid, cb) => { cb(appUser); return () => {} })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    user: { uid: 'u1' } as User,
    role: 'USER',
    loading: false,
    signIn: vi.fn(),
    logOut: vi.fn(),
    refreshRole: vi.fn(),
  })
  vi.mocked(updateUserSettings).mockResolvedValue(undefined)
})

describe('Settings — display', () => {
  it('shows the current articlesAppUid', () => {
    mockSubscribe(makeAppUser({ articlesAppUid: 'articles-uid-123' }))
    render(<Settings />)
    expect(screen.getByDisplayValue('articles-uid-123')).toBeInTheDocument()
  })

  it('shows existing interest keywords as removable chips', () => {
    mockSubscribe(makeAppUser({ interestKeywords: ['woodworking', 'astronomy'] }))
    render(<Settings />)
    expect(screen.getByText('woodworking')).toBeInTheDocument()
    expect(screen.getByText('astronomy')).toBeInTheDocument()
  })

  it('shows a load error when the subscription fails', () => {
    vi.mocked(subscribeToUser).mockImplementation((_uid, _cb, onError) => { onError?.(new Error('BOOM load')); return () => {} })
    render(<Settings />)
    expect(screen.getByText(/BOOM load/)).toBeInTheDocument()
  })
})

describe('Settings — editing', () => {
  it('adds a new keyword to the list', async () => {
    mockSubscribe(makeAppUser({ interestKeywords: ['woodworking'] }))
    render(<Settings />)

    await userEvent.type(screen.getByLabelText(/add keyword/i), 'astronomy{enter}')

    expect(screen.getByText('astronomy')).toBeInTheDocument()
  })

  it('removes a keyword from the list', async () => {
    mockSubscribe(makeAppUser({ interestKeywords: ['woodworking', 'astronomy'] }))
    render(<Settings />)

    await userEvent.click(screen.getByRole('button', { name: /remove woodworking/i }))

    expect(screen.queryByText('woodworking')).not.toBeInTheDocument()
    expect(screen.getByText('astronomy')).toBeInTheDocument()
  })

  it('saves articlesAppUid and interestKeywords on submit', async () => {
    mockSubscribe(makeAppUser({ articlesAppUid: null, interestKeywords: ['woodworking'] }))
    render(<Settings />)

    await userEvent.type(screen.getByLabelText(/articles.astrojason.com uid/i), 'new-articles-uid')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(updateUserSettings).toHaveBeenCalledWith('u1', {
        articlesAppUid: 'new-articles-uid',
        interestKeywords: ['woodworking'],
      })
    })
  })

  it('shows a copyable error block when saving fails', async () => {
    vi.mocked(updateUserSettings).mockRejectedValue(new Error('BOOM save'))
    mockSubscribe(makeAppUser())
    render(<Settings />)

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByText(/BOOM save/)).toBeInTheDocument()
    })
  })
})
