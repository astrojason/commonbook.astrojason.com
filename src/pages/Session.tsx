import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSessionById, updateSession } from '../lib/sessions'
import { getNoteById } from '../lib/notes'
import { getTokensUsed, reportTokens, DAILY_LIMIT } from '../lib/tokenTracker'
import { Rule } from '../components/Rule'
import type { Message, Note, Session } from '../types'

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<Session | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [streamText, setStreamText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [tokenGate, setTokenGate] = useState(false)
  const [tokenGateCount, setTokenGateCount] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sessionId) return
    async function init() {
      const sess = await getSessionById(sessionId!)
      if (!sess) { setLoading(false); return }
      const n = await getNoteById(sess.note_id)
      setSession(sess)
      setNote(n)
      setMessages(sess.messages)
      setLoading(false)

      const used = await getTokensUsed()
      if (used !== null && used >= DAILY_LIMIT) {
        setTokenGate(true)
        setTokenGateCount(used)
      }
    }
    init()
  }, [sessionId])

  useEffect(() => {
    if (bottomRef.current && typeof bottomRef.current.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, streamText])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function handleSend(text: string = input) {
    const trimmed = text.trim()
    if (!trimmed || !session || !note || streaming || done) return

    if (!navigator.onLine) {
      setToast('No internet connection — sessions require a live connection.')
      return
    }

    const prevMessages = messages
    const userMessage: Message = { role: 'user', content: trimmed }
    const outgoing = [...prevMessages, userMessage]

    setMessages(outgoing)
    setInput('')
    setStreaming(true)
    setStreamText('')
    setError(null)
    setRetryMessage(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          noteContext: {
            what_it_said: note.what_it_said,
            why_it_matters: note.why_it_matters,
            application: note.application,
          },
          messages: outgoing,
        }),
      })

      if (!res.ok) throw new Error(`API error ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let accumulated = ''
      let tokenCount = 0

      outer: while (true) {
        const { done: readerDone, value } = await reader.read()
        if (readerDone) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') break outer

          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>
              usage?: { prompt_tokens?: number; completion_tokens?: number }
            }

            if (chunk.usage) {
              tokenCount = (chunk.usage.prompt_tokens ?? 0) + (chunk.usage.completion_tokens ?? 0)
            }

            const delta = chunk.choices?.[0]?.delta?.content
            if (delta) {
              accumulated += delta
              setStreamText(accumulated)
            }
          } catch {
            // ignore malformed SSE chunks
          }
        }
      }

      const isComplete = accumulated.includes('SESSION_COMPLETE')
      const displayContent = accumulated
        .replace(/\nSESSION_COMPLETE\s*$/, '')
        .replace(/SESSION_COMPLETE\s*$/, '')
        .trim()

      const assistantMessage: Message = {
        role: 'assistant',
        content: displayContent || accumulated,
      }
      const finalMessages = [...outgoing, assistantMessage]

      setMessages(finalMessages)
      setStreamText('')
      setStreaming(false)

      const updateData: { messages: Message[]; completed_at?: Date } = { messages: finalMessages }
      if (isComplete) updateData.completed_at = new Date()
      await updateSession(session.id, updateData)

      if (tokenCount > 0) {
        await reportTokens(tokenCount)
      }

      if (isComplete) {
        setDone(true)
        navigate(`/note/${note.id}`, {
          state: { sessionComplete: true, sessionId: session.id },
        })
      }
    } catch {
      setMessages(prevMessages)
      setStreamText('')
      setStreaming(false)
      setError('Connection interrupted.')
      setRetryMessage(trimmed)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) return null

  if (!session || !note) {
    return <div className="px-5 pt-8 font-mono text-dim">Session not found.</div>
  }

  const shortId = session.id.slice(-4).toUpperCase()

  return (
    <div className="flex flex-col min-h-full pt-5 pb-32">
      {/* header */}
      <div className="px-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block w-[8px] h-[8px] bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.18em]">
            Session · {shortId}
          </span>
        </div>
        <button
          onClick={() => navigate(`/note/${note.id}`)}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted hover:text-[color:var(--text)]"
        >
          end
        </button>
      </div>

      <div className="px-5 mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
        {note.tag} · {note.title}
      </div>

      <div className="mt-4"><Rule /></div>

      {/* token gate */}
      {tokenGate && (
        <div className="px-5 py-6 bg-ink-2 mx-5 mt-5 border border-rule-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
            High usage
          </div>
          <div className="mt-2 font-mono text-[13px] text-[color:var(--text)]">
            You've used {Math.round(tokenGateCount / 1000)}k tokens today. Continue anyway?
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => setTokenGate(false)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border border-accent text-accent"
            >
              Continue →
            </button>
            <button
              onClick={() => navigate(`/note/${note.id}`)}
              className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border border-rule text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!tokenGate && (
        <>
          {/* transcript */}
          <div className="px-5 py-5 font-mono text-[13px] leading-[1.7] space-y-5 flex-1">
            {messages.length === 0 && !streaming && (
              <div className="text-dim">Waiting for your first message…</div>
            )}

            {messages.map((m, i) => (
              <div key={i}>
                <div
                  className="font-mono text-[11px] uppercase tracking-[0.18em]"
                  style={{
                    color: m.role === 'user' ? 'var(--accent)' : 'var(--muted)',
                    fontWeight: 500,
                  }}
                >
                  {m.role === 'user' ? '> me' : 'recall'}
                </div>
                <div className="mt-[2px] text-[color:var(--text)]">{m.content}</div>
              </div>
            ))}

            {streaming && (
              <div>
                <div
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
                  style={{ fontWeight: 500 }}
                >
                  recall
                </div>
                <div className="mt-[2px] text-[color:var(--text)]">
                  {streamText || (
                    <span className="text-dim flex items-center gap-2">
                      <span className="inline-block w-[7px] h-[14px] bg-accent animate-pulse" />
                    </span>
                  )}
                </div>
              </div>
            )}

            {done && (
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
                — session complete —
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* inline error + retry */}
          {error && (
            <div className="px-5 pb-3 flex items-center gap-3">
              <span className="font-mono text-[12px] text-accent">{error}</span>
              {retryMessage && (
                <button
                  onClick={() => handleSend(retryMessage)}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border border-accent text-accent"
                >
                  retry →
                </button>
              )}
            </div>
          )}

          {/* composer */}
          {!done && (
            <div className="border-t border-rule">
              <div className="px-5 py-3">
                <div className="flex items-start gap-2 font-mono text-[13px]">
                  <span className="text-accent shrink-0 pt-[2px]">&gt;</span>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder="type your answer…"
                    disabled={streaming}
                    aria-label="message input"
                    className="flex-1 bg-transparent border-0 outline-none resize-none caret-accent leading-relaxed disabled:opacity-50"
                    style={{ color: 'var(--text)' }}
                  />
                </div>
              </div>
              <div className="px-5 pb-4 flex justify-end">
                <button
                  onClick={() => handleSend()}
                  disabled={streaming || !input.trim()}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 border border-accent text-accent disabled:border-rule disabled:text-dim"
                >
                  {streaming ? '…' : 'send ↵'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* offline toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-ink-2 border border-rule px-4 py-3 font-mono text-[12px] text-muted max-w-[320px] text-center"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
