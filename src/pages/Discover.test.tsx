import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Discover from './Discover'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToUser } from '../lib/users'
import {
  fetchDiscoverFeed,
  markArticleRead,
  ingestArticle,
  draftNote,
  NeedsManualPasteError,
} from '../lib/discover'
import type { AppUser } from '../lib/users'
import type { DiscoverArticle } from '../lib/discover'
import type { User } from 'firebase/auth'

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../lib/users', () => ({ subscribeToUser: vi.fn() }))
vi.mock('../lib/discover', async () => {
  const actual = await vi.importActual<typeof import('../lib/discover')>('../lib/discover')
  return {
    ...actual,
    fetchDiscoverFeed: vi.fn(),
    markArticleRead: vi.fn(),
    ingestArticle: vi.fn(),
    draftNote: vi.fn(),
  }
})

const getIdToken = vi.fn().mockResolvedValue('id-token')

function makeAppUser(overrides: Partial<AppUser> = {}): AppUser {
  return {
    uid: 'u1', email: 'me@example.com', displayName: 'Me',
    role: 'USER', articlesAppUid: 'articles-uid', interestKeywords: ['woodworking'],
    ...overrides,
  }
}

function makeArticle(overrides: Partial<DiscoverArticle> = {}): DiscoverArticle {
  return {
    id: 1,
    title: 'A Great Article',
    url: 'https://example.com/great-article',
    summary: 'An excellent summary of the article.',
    readingTime: 6,
    searchTerms: ['woodworking'],
    categories: ['DIY'],
    content: '',
    createdAt: 1700000000,
    ...overrides,
  }
}

function mockSettings(appUser: AppUser | null) {
  vi.mocked(subscribeToUser).mockImplementation((_uid, cb) => { cb(appUser); return () => {} })
}

function renderDiscover() {
  return render(
    <MemoryRouter initialEntries={['/discover']}>
      <Routes>
        <Route path="/discover" element={<Discover />} />
        <Route path="/capture" element={<div>capture-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  getIdToken.mockResolvedValue('id-token')
  vi.mocked(useAuth).mockReturnValue({
    user: { uid: 'u1', getIdToken } as unknown as User,
    role: 'USER',
    loading: false,
    signIn: vi.fn(),
    logOut: vi.fn(),
    refreshRole: vi.fn(),
  })
  vi.mocked(fetchDiscoverFeed).mockResolvedValue({ articles: [makeArticle()], categories: ['DIY'] })
  vi.mocked(markArticleRead).mockResolvedValue(undefined)
  vi.mocked(ingestArticle).mockResolvedValue({ content: 'scraped text', scraped: true })
  vi.mocked(draftNote).mockResolvedValue({ tag: 'diy', what_it_said: 'W', why_it_matters: 'Y', application: 'A' })
})

describe('Discover — empty states', () => {
  it('prompts the user to set interest keywords in Settings when none are configured', () => {
    mockSettings(makeAppUser({ interestKeywords: [] }))
    renderDiscover()
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
    expect(fetchDiscoverFeed).not.toHaveBeenCalled()
  })

  it('prompts the user to configure articlesAppUid in Settings when unset', () => {
    mockSettings(makeAppUser({ articlesAppUid: null }))
    renderDiscover()
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
    expect(fetchDiscoverFeed).not.toHaveBeenCalled()
  })

  it('shows a message when the feed has no matching articles', async () => {
    mockSettings(makeAppUser())
    vi.mocked(fetchDiscoverFeed).mockResolvedValue({ articles: [], categories: [] })
    renderDiscover()
    await waitFor(() => {
      expect(screen.getByText(/no articles/i)).toBeInTheDocument()
    })
  })
})

describe('Discover — card display', () => {
  it('shows the current card title, summary, and reading time', async () => {
    mockSettings(makeAppUser())
    renderDiscover()
    await waitFor(() => {
      expect(screen.getByText('A Great Article')).toBeInTheDocument()
    })
    expect(screen.getByText(/An excellent summary/)).toBeInTheDocument()
    expect(screen.getByText(/6/)).toBeInTheDocument()
  })

  it('shows a load error as a copyable block', async () => {
    mockSettings(makeAppUser())
    vi.mocked(fetchDiscoverFeed).mockRejectedValue(new Error('BOOM feed'))
    renderDiscover()
    await waitFor(() => {
      expect(screen.getByText(/BOOM feed/)).toBeInTheDocument()
    })
  })
})

describe('Discover — search and category filters', () => {
  it('re-fetches with the search term on submit', async () => {
    mockSettings(makeAppUser())
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(fetchDiscoverFeed).toHaveBeenCalledTimes(1))

    await user.type(screen.getByPlaceholderText(/search/i), 'chisel{enter}')

    await waitFor(() => {
      expect(fetchDiscoverFeed).toHaveBeenLastCalledWith(
        'id-token', 'articles-uid', ['woodworking'], expect.objectContaining({ search: 'chisel' }),
      )
    })
  })

  it('re-fetches with the selected category on chip click', async () => {
    mockSettings(makeAppUser())
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(screen.getByRole('button', { name: 'DIY' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'DIY' }))

    await waitFor(() => {
      expect(fetchDiscoverFeed).toHaveBeenLastCalledWith(
        'id-token', 'articles-uid', ['woodworking'], expect.objectContaining({ category: 'DIY' }),
      )
    })
  })
})

describe('Discover — skip', () => {
  it('marks the card read and removes it from the deck', async () => {
    mockSettings(makeAppUser())
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(screen.getByText('A Great Article')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /skip/i }))

    await waitFor(() => {
      expect(markArticleRead).toHaveBeenCalledWith('id-token', 'articles-uid', 1)
      expect(screen.queryByText('A Great Article')).not.toBeInTheDocument()
    })
  })
})

describe('Discover — promote', () => {
  it('skips ingest and drafts directly when the article already has content', async () => {
    mockSettings(makeAppUser())
    vi.mocked(fetchDiscoverFeed).mockResolvedValue({
      articles: [makeArticle({ content: 'already scraped full text' })],
      categories: [],
    })
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(screen.getByText('A Great Article')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /promote/i }))

    await waitFor(() => {
      expect(ingestArticle).not.toHaveBeenCalled()
      expect(draftNote).toHaveBeenCalledWith('A Great Article', 'already scraped full text')
      expect(screen.getByText('capture-page')).toBeInTheDocument()
    })
  })

  it('ingests (scrape) then drafts then navigates to a pre-filled Capture form', async () => {
    mockSettings(makeAppUser())
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(screen.getByText('A Great Article')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /promote/i }))

    await waitFor(() => {
      expect(ingestArticle).toHaveBeenCalledWith('id-token', 1, { url: 'https://example.com/great-article' })
      expect(draftNote).toHaveBeenCalledWith('A Great Article', 'scraped text')
      expect(markArticleRead).toHaveBeenCalledWith('id-token', 'articles-uid', 1)
      expect(screen.getByText('capture-page')).toBeInTheDocument()
    })
  })

  it('shows a manual-paste textarea when ingest needs manual paste, and continues after submit', async () => {
    mockSettings(makeAppUser())
    vi.mocked(ingestArticle).mockRejectedValueOnce(new NeedsManualPasteError('could not scrape'))
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(screen.getByText('A Great Article')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /promote/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste/i)).toBeInTheDocument()
    })

    vi.mocked(ingestArticle).mockResolvedValue({ content: 'pasted full text', scraped: false })
    await user.type(screen.getByPlaceholderText(/paste/i), 'pasted full text')
    await user.click(screen.getByRole('button', { name: /use this text/i }))

    await waitFor(() => {
      expect(ingestArticle).toHaveBeenLastCalledWith('id-token', 1, { pastedContent: 'pasted full text' })
      expect(draftNote).toHaveBeenCalledWith('A Great Article', 'pasted full text')
      expect(screen.getByText('capture-page')).toBeInTheDocument()
    })
  })

  it('shows a copyable error block when draftNote fails', async () => {
    mockSettings(makeAppUser())
    vi.mocked(draftNote).mockRejectedValue(new Error('BOOM draft'))
    const user = userEvent.setup()
    renderDiscover()
    await waitFor(() => expect(screen.getByText('A Great Article')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /promote/i }))

    await waitFor(() => {
      expect(screen.getByText(/BOOM draft/)).toBeInTheDocument()
    })
  })
})
