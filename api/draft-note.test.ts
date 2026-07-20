// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OpenAI from 'openai'
import handler, { buildDraftPrompt } from './draft-note'

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

function mockReq(body: object, method = 'POST') {
  return { method, body }
}

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() }
}

function aiResponse(obj: object) {
  return { choices: [{ message: { content: JSON.stringify(obj) } }] }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(OpenAI).mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  }) as unknown as OpenAI)
})

describe('buildDraftPrompt', () => {
  it('includes the article title and body', () => {
    const prompt = buildDraftPrompt('My Title', 'Body text here')
    expect(prompt).toContain('My Title')
    expect(prompt).toContain('Body text here')
  })

  it('asks for the four required JSON fields', () => {
    const prompt = buildDraftPrompt('T', 'B')
    expect(prompt).toContain('what_it_said')
    expect(prompt).toContain('why_it_matters')
    expect(prompt).toContain('application')
    expect(prompt).toContain('tag')
  })
})

describe('POST /api/draft-note', () => {
  it('rejects non-POST methods', async () => {
    const res = mockRes()
    await handler(mockReq({}, 'GET') as never, res as never)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('rejects a request missing title', async () => {
    const res = mockRes()
    await handler(mockReq({ content: 'body' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects a request with neither content nor summary', async () => {
    const res = mockRes()
    await handler(mockReq({ title: 'T' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('prefers content over summary when both are present', async () => {
    mockCreate.mockResolvedValue(aiResponse({ tag: 't', what_it_said: 'w', why_it_matters: 'y', application: 'a' }))
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: 'FULL TEXT', summary: 'short summary' }) as never, res as never)

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content
    expect(promptSent).toContain('FULL TEXT')
    expect(promptSent).not.toContain('short summary')
  })

  it('falls back to summary when content is empty', async () => {
    mockCreate.mockResolvedValue(aiResponse({ tag: 't', what_it_said: 'w', why_it_matters: 'y', application: 'a' }))
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: '', summary: 'short summary' }) as never, res as never)

    const promptSent = mockCreate.mock.calls[0][0].messages[0].content
    expect(promptSent).toContain('short summary')
  })

  it('returns the parsed draft fields on success', async () => {
    mockCreate.mockResolvedValue(aiResponse({ tag: 'physics', what_it_said: 'W', why_it_matters: 'Y', application: 'A' }))
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: 'body' }) as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ tag: 'physics', what_it_said: 'W', why_it_matters: 'Y', application: 'A' })
  })

  it('defaults tag to empty string if the model omits it', async () => {
    mockCreate.mockResolvedValue(aiResponse({ what_it_said: 'W', why_it_matters: 'Y', application: 'A' }))
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: 'body' }) as never, res as never)

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ tag: '' }))
  })

  it('returns 502 when OpenAI throws', async () => {
    mockCreate.mockRejectedValue(new Error('boom'))
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: 'body' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('returns 502 when the model response is not valid JSON', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'not json' } }] })
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: 'body' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(502)
  })

  it('returns 502 when required fields are missing from the parsed JSON', async () => {
    mockCreate.mockResolvedValue(aiResponse({ tag: 't' }))
    const res = mockRes()
    await handler(mockReq({ title: 'T', content: 'body' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(502)
  })
})
