// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpenAI from 'openai'
import handler, { buildSystemPrompt } from './chat'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

async function* makeStream(chunks: object[]) {
  for (const chunk of chunks) {
    yield chunk
  }
}

function mockReq(body: object, method = 'POST') {
  return { method, body }
}

function mockRes() {
  const written: string[] = []
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    writeHead: vi.fn(),
    write: vi.fn().mockImplementation((data: string) => { written.push(data) }),
    end: vi.fn(),
    _written: written,
  }
  return res
}

const NOTE_CTX = {
  what_it_said: 'WHAT_TEXT',
  why_it_matters: 'WHY_TEXT',
  application: 'APP_TEXT',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(OpenAI).mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }) as unknown as OpenAI)
})

describe('buildSystemPrompt', () => {
  it('injects all three note fields into the prompt', () => {
    const prompt = buildSystemPrompt(NOTE_CTX)
    expect(prompt).toContain('WHAT_TEXT')
    expect(prompt).toContain('WHY_TEXT')
    expect(prompt).toContain('APP_TEXT')
  })

  it('includes the SESSION_COMPLETE instruction', () => {
    const prompt = buildSystemPrompt(NOTE_CTX)
    expect(prompt).toContain('SESSION_COMPLETE')
  })
})

describe('handler — validation', () => {
  it('returns 400 when noteContext is missing', async () => {
    const res = mockRes()
    await handler(mockReq({ messages: [] }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing noteContext' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when the body is empty', async () => {
    const res = mockRes()
    await handler(mockReq({}), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Missing noteContext' })
  })

  it('returns 405 for non-POST requests', async () => {
    const res = mockRes()
    await handler(mockReq({}, 'GET'), res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' })
  })
})

describe('handler — system prompt', () => {
  it('injects note fields into the system message sent to OpenAI', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: 'hello' } }] },
    ]))

    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX, messages: [] }), res)

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArgs = mockCreate.mock.calls[0][0]
    const systemMsg = callArgs.messages.find(
      (m: { role: string }) => m.role === 'system',
    )
    expect(systemMsg).toBeDefined()
    expect(systemMsg.content).toContain('WHAT_TEXT')
    expect(systemMsg.content).toContain('WHY_TEXT')
    expect(systemMsg.content).toContain('APP_TEXT')
  })

  it('prepends the system prompt before conversation messages', async () => {
    mockCreate.mockResolvedValue(makeStream([]))

    const userMessage = { role: 'user', content: 'test question' }
    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX, messages: [userMessage] }), res)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.messages[0].role).toBe('system')
    expect(callArgs.messages[1]).toEqual(userMessage)
  })
})

describe('handler — SSE stream', () => {
  it('forwards each chunk as an SSE data line', async () => {
    const chunk1 = { choices: [{ delta: { content: 'hello ' } }] }
    const chunk2 = { choices: [{ delta: { content: 'world' } }] }
    mockCreate.mockResolvedValue(makeStream([chunk1, chunk2]))

    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX }), res)

    const allWritten = res._written.join('')
    expect(allWritten).toContain(`data: ${JSON.stringify(chunk1)}`)
    expect(allWritten).toContain(`data: ${JSON.stringify(chunk2)}`)
  })

  it('forwards the usage chunk', async () => {
    const usageChunk = {
      choices: [],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }
    mockCreate.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: 'text' } }] },
      usageChunk,
    ]))

    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX }), res)

    const allWritten = res._written.join('')
    expect(allWritten).toContain(JSON.stringify(usageChunk))
  })

  it('ends with [DONE] and calls res.end()', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: 'hi' } }] },
    ]))

    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX }), res)

    expect(res._written.at(-1)).toBe('data: [DONE]\n\n')
    expect(res.end).toHaveBeenCalledOnce()
  })

  it('uses model gpt-4o-mini with streaming options', async () => {
    mockCreate.mockResolvedValue(makeStream([]))

    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX }), res)

    const callArgs = mockCreate.mock.calls[0][0]
    expect(callArgs.model).toBe('gpt-4o-mini')
    expect(callArgs.stream).toBe(true)
    expect(callArgs.stream_options).toEqual({ include_usage: true })
  })
})

describe('handler — OpenAI error', () => {
  it('writes an error event and ends the response if OpenAI throws', async () => {
    mockCreate.mockRejectedValue(new Error('API failure'))

    const res = mockRes()
    await handler(mockReq({ noteContext: NOTE_CTX }), res)

    const allWritten = res._written.join('')
    expect(allWritten).toContain('"error"')
    expect(res.end).toHaveBeenCalledOnce()
  })
})
