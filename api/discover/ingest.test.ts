// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { scrapeArticleFullText } from '../_lib/scrapeArticle'
import { updateArticleContent } from '../_lib/turso'
import handler from './ingest'

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn((x: unknown) => x),
}))
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn() }))
vi.mock('../_lib/scrapeArticle', () => ({ scrapeArticleFullText: vi.fn() }))
vi.mock('../_lib/turso', () => ({ updateArticleContent: vi.fn() }))

const verifyIdToken = vi.fn()

function mockReq(body: object, headers: Record<string, string> = { authorization: 'Bearer good-token' }, method = 'POST') {
  return { method, body, headers }
}

function mockRes() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '{"project_id":"test"}'
  vi.mocked(getApps).mockReturnValue([])
  vi.mocked(initializeApp).mockReturnValue({} as never)
  vi.mocked(getAuth).mockReturnValue({ verifyIdToken } as never)
  verifyIdToken.mockResolvedValue({ role: 'USER', uid: 'caller-1' })
  vi.mocked(updateArticleContent).mockResolvedValue(undefined)
})

describe('POST /api/discover/ingest', () => {
  it('rejects non-POST methods', async () => {
    const res = mockRes()
    await handler(mockReq({}, undefined, 'GET') as never, res as never)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('rejects requests with no Authorization header', async () => {
    const res = mockRes()
    await handler(mockReq({ articleId: 1, url: 'https://x.com' }, {}) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects a PENDING caller', async () => {
    verifyIdToken.mockResolvedValue({ role: 'PENDING' })
    const res = mockRes()
    await handler(mockReq({ articleId: 1, url: 'https://x.com' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('rejects a request missing articleId', async () => {
    const res = mockRes()
    await handler(mockReq({ url: 'https://x.com' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('uses pastedContent directly without scraping when provided', async () => {
    const res = mockRes()
    await handler(mockReq({ articleId: 1, url: 'https://x.com', pastedContent: 'user pasted text' }) as never, res as never)

    expect(scrapeArticleFullText).not.toHaveBeenCalled()
    expect(updateArticleContent).toHaveBeenCalledWith(1, 'user pasted text')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ content: 'user pasted text', scraped: false })
  })

  it('scrapes and persists content when no pastedContent is given', async () => {
    vi.mocked(scrapeArticleFullText).mockResolvedValue('scraped full text')
    const res = mockRes()
    await handler(mockReq({ articleId: 1, url: 'https://x.com' }) as never, res as never)

    expect(scrapeArticleFullText).toHaveBeenCalledWith('https://x.com')
    expect(updateArticleContent).toHaveBeenCalledWith(1, 'scraped full text')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ content: 'scraped full text', scraped: true })
  })

  it('returns 422 (needs manual paste) when scraping fails and no pastedContent was given', async () => {
    vi.mocked(scrapeArticleFullText).mockResolvedValue(null)
    const res = mockRes()
    await handler(mockReq({ articleId: 1, url: 'https://x.com' }) as never, res as never)

    expect(updateArticleContent).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(422)
  })

  it('rejects a request with neither url nor pastedContent', async () => {
    const res = mockRes()
    await handler(mockReq({ articleId: 1 }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })
})
