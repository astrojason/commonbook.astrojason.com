import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Library from './Library'
import { subscribeToNotes } from '../lib/notes'
import type { Note } from '../types'
import type { Timestamp } from 'firebase/firestore'

vi.mock('../lib/notes', () => ({ subscribeToNotes: vi.fn() }))

const mockTs = (date: Date) => ({ toDate: () => date } as unknown as Timestamp)

function makeNote(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    title: 'Default Title',
    tag: 'general',
    source_url: null,
    what_it_said: 'Content.',
    why_it_matters: 'Matters.',
    application: 'Apply it.',
    created_at: mockTs(new Date('2026-05-01')),
    next_review_at: mockTs(new Date('2026-06-01')),
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

function renderLibrary() {
  return render(
    <MemoryRouter initialEntries={['/library']}>
      <Routes>
        <Route path="/library" element={<Library />} />
        <Route path="/note/:id" element={<div>note-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const NOTE_A = makeNote({ id: 'a', title: 'Alpha Title', tag: 'math' })
const NOTE_B = makeNote({ id: 'b', title: 'Beta Title',  tag: 'science' })
const NOTE_C = makeNote({ id: 'c', title: 'Gamma Title', tag: 'math' })

beforeEach(() => {
  vi.clearAllMocks()
  mockSubscribe([NOTE_A, NOTE_B, NOTE_C])
})

describe('Library — display', () => {
  it('renders all notes by default', async () => {
    renderLibrary()
    expect(await screen.findByText('Alpha Title')).toBeInTheDocument()
    expect(screen.getByText('Beta Title')).toBeInTheDocument()
    expect(screen.getByText('Gamma Title')).toBeInTheDocument()
  })

  it('shows total / filtered count', async () => {
    renderLibrary()
    expect(await screen.findByText('3 / 3')).toBeInTheDocument()
  })
})

describe('Library — search', () => {
  it('filters notes by title', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.type(await screen.findByLabelText('search'), 'alpha')
    expect(screen.getByText('Alpha Title')).toBeInTheDocument()
    expect(screen.queryByText('Beta Title')).not.toBeInTheDocument()
    expect(screen.queryByText('Gamma Title')).not.toBeInTheDocument()
  })

  it('filters notes by tag', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.type(await screen.findByLabelText('search'), 'science')
    expect(screen.getByText('Beta Title')).toBeInTheDocument()
    expect(screen.queryByText('Alpha Title')).not.toBeInTheDocument()
  })

  it('is case-insensitive', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.type(await screen.findByLabelText('search'), 'ALPHA')
    expect(screen.getByText('Alpha Title')).toBeInTheDocument()
  })

  it('shows "No notes match" when search has no results', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.type(await screen.findByLabelText('search'), 'xyznotfound')
    expect(screen.getByText(/no notes match/i)).toBeInTheDocument()
  })

  it('updates filtered count after search', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await user.type(await screen.findByLabelText('search'), 'alpha')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })
})

describe('Library — tag filter', () => {
  it('filters to notes with the selected tag', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await screen.findByText('Alpha Title')
    // click the "math" chip
    const mathChips = screen.getAllByRole('button', { name: /^math$/i })
    await user.click(mathChips[0])

    expect(screen.getByText('Alpha Title')).toBeInTheDocument()
    expect(screen.getByText('Gamma Title')).toBeInTheDocument()
    expect(screen.queryByText('Beta Title')).not.toBeInTheDocument()
  })

  it('returns to all notes when "all" is clicked', async () => {
    const user = userEvent.setup()
    renderLibrary()

    await screen.findByText('Alpha Title')
    const mathChip = screen.getAllByRole('button', { name: /^math$/i })[0]
    await user.click(mathChip)
    await user.click(screen.getByRole('button', { name: /^all$/i }))

    expect(screen.getByText('Beta Title')).toBeInTheDocument()
  })
})

describe('Library — sort', () => {
  it('sorts by most recent (created_at desc) by default', async () => {
    const notes = [
      makeNote({ id: 'a', title: 'Older', created_at: mockTs(new Date('2026-01-01')) }),
      makeNote({ id: 'b', title: 'Newer', created_at: mockTs(new Date('2026-05-01')) }),
    ]
    mockSubscribe(notes)
    renderLibrary()

    await screen.findByText('Newer')
    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Newer')).toBeLessThan(allText.indexOf('Older'))
  })

  it('sorts by strength (last_rating desc) when strength sort is selected', async () => {
    const notes = [
      makeNote({ id: 'a', title: 'Weak',   last_rating: 1 }),
      makeNote({ id: 'b', title: 'Strong',  last_rating: 5 }),
      makeNote({ id: 'c', title: 'Medium',  last_rating: 3 }),
    ]
    mockSubscribe(notes)

    const user = userEvent.setup()
    renderLibrary()

    await user.click(await screen.findByRole('button', { name: /^strength$/i }))

    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Strong')).toBeLessThan(allText.indexOf('Medium'))
    expect(allText.indexOf('Medium')).toBeLessThan(allText.indexOf('Weak'))
  })

  it('sorts null ratings last in strength sort', async () => {
    const notes = [
      makeNote({ id: 'a', title: 'Unrated', last_rating: null }),
      makeNote({ id: 'b', title: 'Rated',   last_rating: 3 }),
    ]
    mockSubscribe(notes)

    const user = userEvent.setup()
    renderLibrary()

    await user.click(await screen.findByRole('button', { name: /^strength$/i }))

    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('Rated')).toBeLessThan(allText.indexOf('Unrated'))
  })

  it('sorts alphabetically by tag when tag sort is selected', async () => {
    const notes = [
      makeNote({ id: 'a', title: 'Z Note', tag: 'zebra' }),
      makeNote({ id: 'b', title: 'A Note', tag: 'alpha' }),
    ]
    mockSubscribe(notes)

    const user = userEvent.setup()
    renderLibrary()

    await user.click(await screen.findByRole('button', { name: /^tag$/i }))

    const allText = document.body.textContent ?? ''
    expect(allText.indexOf('A Note')).toBeLessThan(allText.indexOf('Z Note'))
  })
})
