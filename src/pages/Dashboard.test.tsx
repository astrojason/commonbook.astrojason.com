import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './Dashboard'
import { subscribeToNotes } from '../lib/notes'
import { getIncompleteSession, createSession } from '../lib/sessions'
import { getStats } from '../lib/stats'
import type { Note, Stats } from '../types'
import type { Timestamp } from 'firebase/firestore'

vi.mock('../lib/notes', () => ({ subscribeToNotes: vi.fn() }))
vi.mock('../lib/sessions', () => ({ getIncompleteSession: vi.fn(), createSession: vi.fn() }))
vi.mock('../lib/stats', () => ({ getStats: vi.fn() }))

const mockTs = (date: Date) => ({ toDate: () => date } as unknown as Timestamp)

const past = new Date(Date.now() - 2 * 86400000)   // 2 days ago — due
const future = new Date(Date.now() + 5 * 86400000)  // 5 days from now — upcoming

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Test Note',
    tag: 'science',
    source_url: null,
    what_it_said: 'Summary text.',
    why_it_matters: 'Because.',
    application: 'Use it.',
    created_at: mockTs(new Date('2026-05-01')),
    next_review_at: mockTs(past),
    last_reviewed_at: null,
    interval_days: 1,
    easiness_factor: 2.5,
    session_count: 0,
    last_rating: null,
    deleted_at: null,
    ...overrides,
  }
}

function mockSubscribe(notes: Note[]) {
  vi.mocked(subscribeToNotes).mockImplementation(cb => { cb(notes); return () => {} })
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/session/:id" element={<div>session-page</div>} />
        <Route path="/note/:id" element={<div>note-page</div>} />
        <Route path="/library" element={<div>library-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSubscribe([])
  vi.mocked(getStats).mockResolvedValue(null)
  vi.mocked(getIncompleteSession).mockResolvedValue(null)
  vi.mocked(createSession).mockResolvedValue('new-sess')
})

describe('Dashboard — due notes', () => {
  it('shows the Begin Session CTA when at least one note is due', async () => {
    mockSubscribe([makeNote({ id: 'n1', next_review_at: mockTs(past) })])
    renderDashboard()
    expect(await screen.findByRole('button', { name: /begin session/i })).toBeInTheDocument()
  })

  it('hides the Begin Session CTA when no notes are due', async () => {
    mockSubscribe([makeNote({ id: 'n1', next_review_at: mockTs(future) })])
    renderDashboard()
    await screen.findByText('Test Note')
    expect(screen.queryByRole('button', { name: /begin session/i })).not.toBeInTheDocument()
  })

  it('shows due count in the due section header', async () => {
    mockSubscribe([
      makeNote({ id: 'n1', title: 'Due One', next_review_at: mockTs(past) }),
      makeNote({ id: 'n2', title: 'Due Two', next_review_at: mockTs(past) }),
      makeNote({ id: 'n3', title: 'Upcoming', next_review_at: mockTs(future) }),
    ])
    renderDashboard()
    expect(await screen.findByText(/due · 02/i)).toBeInTheDocument()
  })

  it('does not show a due section when no notes are due', async () => {
    mockSubscribe([makeNote({ id: 'n1', next_review_at: mockTs(future) })])
    renderDashboard()
    await screen.findByText('Test Note')
    expect(screen.queryByText(/due ·/i)).not.toBeInTheDocument()
  })

  it('sorts due notes most-overdue first', async () => {
    const oldest = new Date(Date.now() - 5 * 86400000)
    const newer = new Date(Date.now() - 1 * 86400000)
    mockSubscribe([
      makeNote({ id: 'n1', title: 'Newer Due', next_review_at: mockTs(newer) }),
      makeNote({ id: 'n2', title: 'Oldest Due', next_review_at: mockTs(oldest) }),
    ])
    renderDashboard()
    // Use findAllByText since note titles appear in both the due list and recent list
    await screen.findAllByText('Oldest Due')
    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Oldest Due')).toBeLessThan(allText.indexOf('Newer Due'))
  })
})

describe('Dashboard — stats', () => {
  it('hides recall percent when total_sessions < 3', async () => {
    vi.mocked(getStats).mockResolvedValue({
      total_sessions: 2,
      passing_sessions: 2,
      total_notes: 5,
    } as Stats)
    renderDashboard()
    await screen.findByText('5') // total_notes renders
    expect(screen.queryByText(/percent/i)).not.toBeInTheDocument()
  })

  it('shows recall percent when total_sessions >= 3', async () => {
    vi.mocked(getStats).mockResolvedValue({
      total_sessions: 4,
      passing_sessions: 3,
      total_notes: 10,
    } as Stats)
    renderDashboard()
    expect(await screen.findByText(/percent/i)).toBeInTheDocument()
    // 3/4 = 75%
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('shows total notes from stats', async () => {
    vi.mocked(getStats).mockResolvedValue({
      total_sessions: 0,
      passing_sessions: 0,
      total_notes: 42,
    } as Stats)
    renderDashboard()
    expect(await screen.findByText('42')).toBeInTheDocument()
  })
})

describe('Dashboard — Begin Session', () => {
  it('resumes an existing incomplete session', async () => {
    mockSubscribe([makeNote({ id: 'note-abc', next_review_at: mockTs(past) })])
    vi.mocked(getIncompleteSession).mockResolvedValue({
      id: 'existing-sess',
      note_id: 'note-abc',
      messages: [],
      completed_at: null,
      self_rating: null,
    suggested_rating: null,
    })

    const user = userEvent.setup()
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /begin session/i }))
    expect(await screen.findByText('session-page')).toBeInTheDocument()
    expect(createSession).not.toHaveBeenCalled()
  })

  it('creates a new session when none exists', async () => {
    mockSubscribe([makeNote({ id: 'note-abc', next_review_at: mockTs(past) })])

    const user = userEvent.setup()
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /begin session/i }))
    await waitFor(() => expect(createSession).toHaveBeenCalledWith('note-abc'))
    expect(await screen.findByText('session-page')).toBeInTheDocument()
  })

  it('starts a session for the most overdue note', async () => {
    const oldest = new Date(Date.now() - 5 * 86400000)
    const newer = new Date(Date.now() - 1 * 86400000)
    mockSubscribe([
      makeNote({ id: 'newer-note', next_review_at: mockTs(newer) }),
      makeNote({ id: 'oldest-note', next_review_at: mockTs(oldest) }),
    ])

    const user = userEvent.setup()
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /begin session/i }))
    await waitFor(() => expect(createSession).toHaveBeenCalledWith('oldest-note'))
  })
})

describe('Dashboard — recent notes', () => {
  it('shows up to 5 recent notes sorted newest first', async () => {
    const notes = Array.from({ length: 6 }, (_, i) =>
      makeNote({
        id: `n${i}`,
        title: `Note ${i}`,
        next_review_at: mockTs(future),
        created_at: mockTs(new Date(2026, 0, i + 1)),
      }),
    )
    mockSubscribe(notes)
    renderDashboard()

    // Note 5 is newest (Jan 6), should appear; Note 0 (Jan 1) should be cut
    expect(await screen.findByText('Note 5')).toBeInTheDocument()
    expect(screen.queryByText('Note 0')).not.toBeInTheDocument()
  })

  it('shows "never reviewed" for a recent note with no last_reviewed_at', async () => {
    mockSubscribe([
      makeNote({ id: 'n1', title: 'Fresh Note', next_review_at: mockTs(future), last_reviewed_at: null }),
    ])
    renderDashboard()

    expect(await screen.findByText('Fresh Note')).toBeInTheDocument()
    expect(screen.getByText(/never reviewed/i)).toBeInTheDocument()
  })

  it('shows the last reviewed age for a recent note that has been reviewed', async () => {
    const reviewedAt = new Date(Date.now() - 3 * 86400000)
    mockSubscribe([
      makeNote({
        id: 'n1',
        title: 'Reviewed Note',
        next_review_at: mockTs(future),
        last_reviewed_at: mockTs(reviewedAt),
      }),
    ])
    renderDashboard()

    expect(await screen.findByText('Reviewed Note')).toBeInTheDocument()
    expect(screen.getByText(/reviewed 3d ago/i)).toBeInTheDocument()
  })

  it('shows the next scheduled review as an actual date for a recent note', async () => {
    mockSubscribe([
      makeNote({ id: 'n1', title: 'Scheduled Note', next_review_at: mockTs(new Date(2026, 6, 20)) }),
    ])
    renderDashboard()

    expect(await screen.findByText('Scheduled Note')).toBeInTheDocument()
    expect(screen.getByText(/next 20 Jul/i)).toBeInTheDocument()
  })
})

describe('Dashboard — beginSession error', () => {
  it('shows a persistent error with the full message when createSession rejects', async () => {
    mockSubscribe([makeNote({ id: 'note-abc', next_review_at: mockTs(past) })])
    vi.mocked(createSession).mockRejectedValue(new Error('Firestore error'))

    const user = userEvent.setup()
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /begin session/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/firestore error/i)
  })

  it('re-enables Begin Session after an error', async () => {
    mockSubscribe([makeNote({ id: 'note-abc', next_review_at: mockTs(past) })])
    vi.mocked(createSession).mockRejectedValue(new Error('Firestore error'))

    const user = userEvent.setup()
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /begin session/i }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: /begin session/i })).not.toBeDisabled()
  })
})

describe('Dashboard — offline toast', () => {
  it('shows a toast and does not start a session when offline', async () => {
    mockSubscribe([makeNote({ id: 'note-abc', next_review_at: mockTs(past) })])
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const user = userEvent.setup()
    renderDashboard()

    await user.click(await screen.findByRole('button', { name: /begin session/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/internet connection/i)
    expect(createSession).not.toHaveBeenCalled()
    expect(getIncompleteSession).not.toHaveBeenCalled()

    onlineSpy.mockRestore()
  })
})
