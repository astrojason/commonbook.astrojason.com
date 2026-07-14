import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Session from './Session'
import { getSessionById, updateSession } from '../lib/sessions'
import { getNoteById } from '../lib/notes'
import { getTokensUsed, reportTokens } from '../lib/tokenTracker'
import type { Note, Session as SessionType } from '../types'
import type { Timestamp } from 'firebase/firestore'

vi.mock('../lib/sessions', () => ({
  getSessionById: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('../lib/notes', () => ({
  getNoteById: vi.fn(),
}))

vi.mock('../lib/tokenTracker', () => ({
  getTokensUsed: vi.fn(),
  reportTokens: vi.fn(),
  DAILY_LIMIT: 250_000,
}))

// Route that captures router state for assertions
function NotePage() {
  const loc = useLocation()
  return (
    <div>
      <div data-testid="note-page">note-page</div>
      <div data-testid="nav-state">{JSON.stringify(loc.state)}</div>
    </div>
  )
}

const mockTs = (date: Date) => ({ toDate: () => date } as unknown as Timestamp)

const mockSession: SessionType = {
  id: 'sess-123',
  note_id: 'note-abc',
  messages: [{ role: 'assistant', content: 'Q1?' }],
  completed_at: null,
  self_rating: null,
    suggested_rating: null,
}

const mockNote: Note = {
  id: 'note-abc',
  title: 'Markov chains',
  tag: 'probability',
  source_url: null,
  what_it_said: 'Memoryless property.',
  why_it_matters: 'Simplifies reasoning.',
  application: 'Think of a frog.',
  created_at: mockTs(new Date('2026-05-01')),
  next_review_at: mockTs(new Date('2026-06-01')),
  last_reviewed_at: null,
  interval_days: 6,
  easiness_factor: 2.5,
  session_count: 1,
  last_rating: 3,
  deleted_at: null,
}

function makeSSEResponse(chunks: object[]): Response {
  const body = [
    ...chunks.map(c => `data: ${JSON.stringify(c)}\n`),
    '\n',
    'data: [DONE]\n\n',
  ].join('')
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return { ok: true, body: stream } as unknown as Response
}

function renderSession(path = '/session/sess-123') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/session/:sessionId" element={<Session />} />
        <Route path="/note/:id" element={<NotePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getSessionById).mockResolvedValue(mockSession)
  vi.mocked(getNoteById).mockResolvedValue(mockNote)
  vi.mocked(updateSession).mockResolvedValue(undefined)
  vi.mocked(getTokensUsed).mockResolvedValue(0)
  vi.mocked(reportTokens).mockResolvedValue(undefined)
  vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(makeSSEResponse([])),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Session — load', () => {
  it('renders the session header after loading', async () => {
    renderSession()
    expect(await screen.findByText(/session ·/i)).toBeInTheDocument()
  })

  it('shows "session not found" if getSessionById returns null', async () => {
    vi.mocked(getSessionById).mockResolvedValue(null)
    renderSession()
    expect(await screen.findByText(/session not found/i)).toBeInTheDocument()
  })

  it('shows note tag and title in the subtitle', async () => {
    renderSession()
    await screen.findByLabelText('message input')
    expect(screen.getByText(/probability · markov chains/i)).toBeInTheDocument()
  })
})

describe('Session — SESSION_COMPLETE detection', () => {
  it('shows completion panel instead of navigating immediately on SESSION_COMPLETE', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Good effort!\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'my answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByTestId('session-complete-marker')).toBeInTheDocument()
    expect(screen.getByTestId('rate-session-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('note-page')).not.toBeInTheDocument()
  })

  it('navigates to note detail with sessionComplete state when rate button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Done.\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await user.click(await screen.findByTestId('rate-session-btn'))

    const navState = await screen.findByTestId('nav-state')
    expect(navState).toHaveTextContent('"sessionComplete":true')
    expect(navState).toHaveTextContent('"sessionId":"sess-123"')
  })

  it('parses RATING:X and passes suggestedRating when rate button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Gaps in your understanding.\nRATING:2\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'my answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await user.click(await screen.findByTestId('rate-session-btn'))

    const navState = await screen.findByTestId('nav-state')
    expect(navState).toHaveTextContent('"suggestedRating":2')
  })

  it('strips RATING:X from the displayed message content', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Assessment here.\nRATING:4\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByTestId('rate-session-btn')
    const [, data] = vi.mocked(updateSession).mock.calls[0]
    const last = data.messages![data.messages!.length - 1]
    expect(last.content).not.toMatch(/RATING:/)
  })
})

describe('Session — Firestore writes', () => {
  it('writes the full message array to Firestore after each exchange', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'The assistant reply.' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'user question')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(updateSession).toHaveBeenCalled())

    const [sid, data] = vi.mocked(updateSession).mock.calls[0]
    expect(sid).toBe('sess-123')
    expect(data.messages).toHaveLength(3)
    expect(data.messages![1]).toEqual({ role: 'user', content: 'user question' })
    expect(data.messages![2]).toMatchObject({ role: 'assistant' })
  })

  it('sets completed_at when SESSION_COMPLETE is detected', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Done!\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByTestId('rate-session-btn')

    const [, data] = vi.mocked(updateSession).mock.calls[0]
    expect(data.completed_at).toBeInstanceOf(Date)
  })

  it('does not set completed_at for a normal (non-complete) exchange', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Just a reply.' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => expect(updateSession).toHaveBeenCalled())
    const [, data] = vi.mocked(updateSession).mock.calls[0]
    expect(data.completed_at).toBeUndefined()
  })
})

describe('Session — mid-stream error', () => {
  it('shows retry button when the fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'my answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/network error/i)
  })

  it('re-enables the message input after an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'my answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText('message input')).not.toBeDisabled()
  })

  it('reverts the user message on error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'failed message')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByRole('button', { name: /retry/i })
    // The failed user message should not remain in the transcript
    expect(screen.queryByText('failed message')).not.toBeInTheDocument()
  })

  it('re-sends the message when retry is clicked', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockRejectedValueOnce(new Error('Network error'))
    fetchSpy.mockResolvedValue(
      makeSSEResponse([{ choices: [{ delta: { content: 'retry response' } }] }]),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'retry this')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await user.click(await screen.findByRole('button', { name: /retry/i }))

    await waitFor(() => expect(updateSession).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument()
  })
})

describe('Session — offline toast', () => {
  it('shows a toast instead of sending when offline', async () => {
    const onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/internet connection/i)
    expect(fetch).not.toHaveBeenCalledWith('/api/chat', expect.anything())

    onlineSpy.mockRestore()
  })
})

describe('Session — completed session loaded from Firestore', () => {
  it('shows completion panel without composer when session has completed_at set', async () => {
    const completedSession: SessionType = {
      ...mockSession,
      messages: [
        { role: 'user', content: 'my answer' },
        { role: 'assistant', content: 'Final assessment here.' },
      ],
      completed_at: mockTs(new Date('2026-06-01')),
    }
    vi.mocked(getSessionById).mockResolvedValue(completedSession)

    renderSession()

    expect(await screen.findByTestId('session-complete-marker')).toBeInTheDocument()
    expect(screen.getByTestId('rate-session-btn')).toBeInTheDocument()
    expect(screen.queryByLabelText('message input')).not.toBeInTheDocument()
  })
})

describe('Session — 5th answer sends to API for final assessment', () => {
  it('calls the API instead of navigating when 5 assistant messages exist', async () => {
    const fiveQuestionSession: SessionType = {
      ...mockSession,
      messages: [
        { role: 'user', content: 'start' },
        { role: 'assistant', content: 'Q1?' },
        { role: 'user', content: 'A1' },
        { role: 'assistant', content: 'Q2?' },
        { role: 'user', content: 'A2' },
        { role: 'assistant', content: 'Q3?' },
        { role: 'user', content: 'A3' },
        { role: 'assistant', content: 'Q4?' },
        { role: 'user', content: 'A4' },
        { role: 'assistant', content: 'Q5?' },
      ],
    }
    vi.mocked(getSessionById).mockResolvedValue(fiveQuestionSession)

    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Good coverage overall.\nRATING:4\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'final answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    expect(await screen.findByTestId('session-complete-marker')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.anything())
    expect(screen.queryByTestId('note-page')).not.toBeInTheDocument()
  })
})

describe('Session — token gate', () => {
  it('shows the token gate when usage is at or over the limit', async () => {
    vi.mocked(getTokensUsed).mockResolvedValue(250_000)

    renderSession()
    expect(await screen.findByText(/tokens today/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument()
  })

  it('dismisses the token gate and shows the session when "Continue" is clicked', async () => {
    vi.mocked(getTokensUsed).mockResolvedValue(300_000)

    const user = userEvent.setup()
    renderSession()

    await user.click(await screen.findByRole('button', { name: /continue/i }))

    expect(screen.queryByText(/tokens today/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('message input')).toBeInTheDocument()
  })
})

describe('Session — auto-start', () => {
  it('calls the API automatically when the session has no messages', async () => {
    vi.mocked(getSessionById).mockResolvedValue({ ...mockSession, messages: [] })
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([{ choices: [{ delta: { content: 'What is the memoryless property?' } }] }]),
      ),
    )

    renderSession()

    expect(await screen.findByText('What is the memoryless property?')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.anything())
  })

  it('does not auto-start when the session already has messages', async () => {
    renderSession()

    await screen.findByLabelText('message input')
    expect(fetch).not.toHaveBeenCalledWith('/api/chat', expect.anything())
  })

  it('does not auto-start when the token gate is active', async () => {
    vi.mocked(getTokensUsed).mockResolvedValue(300_000)
    vi.mocked(getSessionById).mockResolvedValue({ ...mockSession, messages: [] })

    renderSession()

    expect(await screen.findByText(/tokens today/i)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith('/api/chat', expect.anything())
  })

  it('shows a note-specific loading prompt in the initial empty state', async () => {
    vi.mocked(getSessionById).mockResolvedValue({ ...mockSession, messages: [] })
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(makeSSEResponse([])),
    )

    renderSession()
    await screen.findByText(/session ·/i)

    await waitFor(() => {
      expect(screen.queryByText(/waiting for your first message/i)).not.toBeInTheDocument()
      expect(screen.getByText(/explain in your own words markov chains/i)).toBeInTheDocument()
    })
  })
})

describe('Session — final report rating label', () => {
  it('includes the suggested rating label in the displayed final message content', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        makeSSEResponse([
          { choices: [{ delta: { content: 'Assessment.\nRATING:3\nSESSION_COMPLETE' } }] },
        ]),
      ),
    )

    const user = userEvent.setup()
    renderSession()

    await user.type(await screen.findByLabelText('message input'), 'answer')
    await user.click(screen.getByRole('button', { name: /send/i }))

    await screen.findByTestId('session-complete-marker')

    const [, data] = vi.mocked(updateSession).mock.calls[0]
    const lastMsg = data.messages![data.messages!.length - 1]
    expect(lastMsg.content).toMatch(/suggested rating.*warm/i)
    expect(lastMsg.content).not.toMatch(/RATING:/)
  })
})
