import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Capture from './Capture'
import { createNote, getNoteById, subscribeToNotes, updateNote } from '../lib/notes'
import { incrementStats } from '../lib/stats'
import type { Note } from '../types'

vi.mock('../lib/notes', () => ({
  createNote: vi.fn(),
  updateNote: vi.fn(),
  getNoteById: vi.fn(),
  subscribeToNotes: vi.fn(),
}))

vi.mock('../lib/stats', () => ({
  incrementStats: vi.fn(),
}))

const mockNote: Partial<Note> = {
  id: 'note-123',
  title: 'Existing title',
  tag: 'probability',
  source_url: null,
  what_it_said: 'What was said',
  why_it_matters: 'Why it matters',
  application: 'How to explain',
}

function renderCapture(path = '/capture') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/capture" element={<Capture />} />
        <Route path="/note/:id" element={<div>note-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(subscribeToNotes).mockImplementation((cb) => { cb([]); return () => {} })
  vi.mocked(createNote).mockResolvedValue('new-id')
  vi.mocked(updateNote).mockResolvedValue(undefined)
  vi.mocked(incrementStats).mockResolvedValue(undefined)
})

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /title/i }), 'T')
  await user.type(screen.getByRole('textbox', { name: /what did it say/i }), 'W')
  await user.type(screen.getByRole('textbox', { name: /why does it matter/i }), 'W')
  await user.type(screen.getByRole('textbox', { name: /how would you explain/i }), 'H')
  await user.type(screen.getByRole('textbox', { name: /tag/i }), 't')
}

describe('Capture — error handling', () => {
  it('shows error when createNote rejects', async () => {
    vi.mocked(createNote).mockRejectedValue(new Error('Firestore error'))
    const user = userEvent.setup()
    renderCapture()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /save entry/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/firestore error/i)
  })

  it('shows error when updateNote rejects', async () => {
    vi.mocked(updateNote).mockRejectedValue(new Error('Firestore error'))
    vi.mocked(getNoteById).mockResolvedValue(mockNote as Note)
    const user = userEvent.setup()
    renderCapture('/capture?edit=note-123')
    await screen.findByDisplayValue('Existing title')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/firestore error/i)
  })

  it('re-enables the submit button after a save error', async () => {
    vi.mocked(createNote).mockRejectedValue(new Error('Firestore error'))
    const user = userEvent.setup()
    renderCapture()
    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /save entry/i }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: /save entry/i })).not.toBeDisabled()
  })
})

describe('Capture — create mode', () => {
  it('shows a validation error and does not call createNote when required fields are empty', async () => {
    const user = userEvent.setup()
    renderCapture()
    await user.click(screen.getByRole('button', { name: /save entry/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/fill in all required fields/i)
    expect(createNote).not.toHaveBeenCalled()
  })

  it('calls createNote with the correct shape on a valid submit', async () => {
    const user = userEvent.setup()
    renderCapture()

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'My title')
    await user.type(screen.getByRole('textbox', { name: /what did it say/i }), 'What was said')
    await user.type(screen.getByRole('textbox', { name: /why does it matter/i }), 'Why it matters')
    await user.type(screen.getByRole('textbox', { name: /how would you explain/i }), 'How to explain')
    await user.type(screen.getByRole('textbox', { name: /tag/i }), 'probability')

    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() => {
      expect(createNote).toHaveBeenCalledWith({
        title: 'My title',
        tag: 'probability',
        source_url: null,
        what_it_said: 'What was said',
        why_it_matters: 'Why it matters',
        application: 'How to explain',
      })
    })
    expect(incrementStats).toHaveBeenCalledWith({ total_notes: 1 })
  })

  it('stores a non-empty source_url when provided', async () => {
    const user = userEvent.setup()
    renderCapture()

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'T')
    await user.type(screen.getByRole('textbox', { name: /what did it say/i }), 'W')
    await user.type(screen.getByRole('textbox', { name: /why does it matter/i }), 'W')
    await user.type(screen.getByRole('textbox', { name: /how would you explain/i }), 'H')
    await user.type(screen.getByRole('textbox', { name: /tag/i }), 'engineering')
    await user.type(screen.getByRole('textbox', { name: /source url/i }), 'https://example.com')

    await user.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() => {
      expect(createNote).toHaveBeenCalledWith(
        expect.objectContaining({ source_url: 'https://example.com' }),
      )
    })
  })
})

describe('Capture — edit mode', () => {
  beforeEach(() => {
    vi.mocked(getNoteById).mockResolvedValue(mockNote as Note)
  })

  it('pre-fills the form with the existing note values', async () => {
    renderCapture('/capture?edit=note-123')
    expect(await screen.findByDisplayValue('Existing title')).toBeInTheDocument()
    expect(screen.getByDisplayValue('What was said')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Why it matters')).toBeInTheDocument()
    expect(screen.getByDisplayValue('How to explain')).toBeInTheDocument()
  })

  it('calls updateNote and not createNote on submit', async () => {
    const user = userEvent.setup()
    renderCapture('/capture?edit=note-123')
    await screen.findByDisplayValue('Existing title')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith('note-123', expect.objectContaining({
        title: 'Existing title',
      }))
      expect(createNote).not.toHaveBeenCalled()
      expect(incrementStats).not.toHaveBeenCalled()
    })
  })

  it('does not include SM-2 fields in the updateNote payload', async () => {
    const user = userEvent.setup()
    renderCapture('/capture?edit=note-123')
    await screen.findByDisplayValue('Existing title')

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(updateNote).toHaveBeenCalled())

    const payload = vi.mocked(updateNote).mock.calls[0][1]
    expect(payload).not.toHaveProperty('interval_days')
    expect(payload).not.toHaveProperty('easiness_factor')
    expect(payload).not.toHaveProperty('session_count')
    expect(payload).not.toHaveProperty('next_review_at')
    expect(payload).not.toHaveProperty('last_rating')
  })
})
