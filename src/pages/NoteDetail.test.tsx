import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import NoteDetail from './NoteDetail'
import { getNoteById, softDeleteNote, updateNoteAfterRating } from '../lib/notes'
import { createSession, getIncompleteSession, updateSession } from '../lib/sessions'
import { incrementStats } from '../lib/stats'
import type { Note, Session } from '../types'
import type { Timestamp } from 'firebase/firestore'

vi.mock('../lib/notes', () => ({
  getNoteById: vi.fn(),
  softDeleteNote: vi.fn(),
  updateNoteAfterRating: vi.fn(),
}))

vi.mock('../lib/sessions', () => ({
  createSession: vi.fn(),
  getIncompleteSession: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('../lib/stats', () => ({
  incrementStats: vi.fn(),
}))

const mockTs = (date: Date) => ({ toDate: () => date } as unknown as Timestamp)

const BASE_DATE = new Date('2026-05-28T10:00:00')
const FUTURE_DATE = new Date('2026-06-10T10:00:00')

const mockNote: Note = {
  id: 'note-abc',
  title: 'Markov chains',
  tag: 'probability',
  source_url: null,
  what_it_said: 'Memoryless property.',
  why_it_matters: 'Simplifies reasoning.',
  application: 'Think of a frog.',
  created_at: mockTs(BASE_DATE),
  next_review_at: mockTs(FUTURE_DATE),
  interval_days: 6,
  easiness_factor: 2.5,
  session_count: 1,
  last_rating: 3,
  deleted_at: null,
}

function renderNoteDetail(
  path = '/note/note-abc',
  state: Record<string, unknown> = {},
) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/note/:id" element={<NoteDetail />} />
        <Route path="/" element={<div>dashboard</div>} />
        <Route path="/session/:sessionId" element={<div>session-page</div>} />
        <Route path="/capture" element={<div>capture-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getNoteById).mockResolvedValue(mockNote)
  vi.mocked(softDeleteNote).mockResolvedValue(undefined)
  vi.mocked(updateNoteAfterRating).mockResolvedValue(undefined)
  vi.mocked(getIncompleteSession).mockResolvedValue(null)
  vi.mocked(createSession).mockResolvedValue('new-session-id')
  vi.mocked(updateSession).mockResolvedValue(undefined)
  vi.mocked(incrementStats).mockResolvedValue(undefined)
})

describe('NoteDetail — display', () => {
  it('renders note title and metadata after load', async () => {
    renderNoteDetail()
    expect(await screen.findByText('Markov chains')).toBeInTheDocument()
    expect(screen.getByText('Memoryless property.')).toBeInTheDocument()
    expect(screen.getByText('probability')).toBeInTheDocument()
  })

  it('shows "note not found" when getNoteById returns null', async () => {
    vi.mocked(getNoteById).mockResolvedValue(null)
    renderNoteDetail()
    expect(await screen.findByText(/note not found/i)).toBeInTheDocument()
  })
})

describe('NoteDetail — self-rating lock', () => {
  it('shows locked message when no sessionComplete state', async () => {
    renderNoteDetail()
    await screen.findByText('Markov chains')
    expect(screen.getByTestId('rating-locked')).toBeInTheDocument()
    expect(screen.queryByTestId('rating-unlocked')).not.toBeInTheDocument()
  })

  it('shows rating buttons when sessionComplete is true', async () => {
    renderNoteDetail('/note/note-abc', { sessionComplete: true })
    await screen.findByText('Markov chains')
    expect(screen.getByTestId('rating-unlocked')).toBeInTheDocument()
    expect(screen.queryByTestId('rating-locked')).not.toBeInTheDocument()
  })
})

describe('NoteDetail — self-rating submit', () => {
  it('runs SM-2 writes and navigates to dashboard on submit', async () => {
    const user = userEvent.setup()
    renderNoteDetail('/note/note-abc', { sessionComplete: true, sessionId: 'sess-123' })
    await screen.findByText('Markov chains')

    await user.click(screen.getByRole('button', { name: 'warm' }))
    await user.click(screen.getByRole('button', { name: /log review/i }))

    await waitFor(() => {
      expect(updateNoteAfterRating).toHaveBeenCalledWith(
        'note-abc',
        expect.objectContaining({ sessionCount: 2 }),
        3,
      )
      expect(updateSession).toHaveBeenCalledWith('sess-123', { self_rating: 3 })
      expect(incrementStats).toHaveBeenCalledWith(
        expect.objectContaining({ total_sessions: 1, passing_sessions: 1 }),
      )
    })

    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('does not increment passing_sessions for a failing rating', async () => {
    const user = userEvent.setup()
    renderNoteDetail('/note/note-abc', { sessionComplete: true })
    await screen.findByText('Markov chains')

    await user.click(screen.getByRole('button', { name: 'cool' }))
    await user.click(screen.getByRole('button', { name: /log review/i }))

    await waitFor(() => expect(incrementStats).toHaveBeenCalled())
    expect(incrementStats).toHaveBeenCalledWith({ total_sessions: 1 })
  })
})

describe('NoteDetail — delete', () => {
  it('calls softDeleteNote and navigates to dashboard on confirmed delete', async () => {
    const user = userEvent.setup()
    renderNoteDetail()
    await screen.findByText('Markov chains')

    await user.click(screen.getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => expect(softDeleteNote).toHaveBeenCalledWith('note-abc'))
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('cancels delete when cancel is clicked', async () => {
    const user = userEvent.setup()
    renderNoteDetail()
    await screen.findByText('Markov chains')

    await user.click(screen.getByRole('button', { name: /delete/i }))
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(softDeleteNote).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })
})

describe('NoteDetail — start session', () => {
  it('resumes an existing incomplete session', async () => {
    const incompleteSession: Session = {
      id: 'existing-sess',
      note_id: 'note-abc',
      messages: [],
      completed_at: null,
      self_rating: null,
    }
    vi.mocked(getIncompleteSession).mockResolvedValue(incompleteSession)

    const user = userEvent.setup()
    renderNoteDetail()
    await screen.findByText('Markov chains')

    await user.click(screen.getByRole('button', { name: /start session/i }))

    await waitFor(() => expect(getIncompleteSession).toHaveBeenCalledWith('note-abc'))
    expect(createSession).not.toHaveBeenCalled()
    expect(await screen.findByText('session-page')).toBeInTheDocument()
  })

  it('creates a new session when none exists', async () => {
    vi.mocked(getIncompleteSession).mockResolvedValue(null)

    const user = userEvent.setup()
    renderNoteDetail()
    await screen.findByText('Markov chains')

    await user.click(screen.getByRole('button', { name: /start session/i }))

    await waitFor(() => expect(createSession).toHaveBeenCalledWith('note-abc'))
    expect(await screen.findByText('session-page')).toBeInTheDocument()
  })
})
