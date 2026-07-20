// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getUnreadArticlesForKeywords, getCategories } from '../_lib/turso'
import handler from './feed'

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn((x: unknown) => x),
}))
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn() }))
vi.mock('../_lib/turso', () => ({
  getUnreadArticlesForKeywords: vi.fn(),
  getCategories: vi.fn(),
}))

const verifyIdToken = vi.fn()

function mockReq(query: Record<string, string>, headers: Record<string, string> = { authorization: 'Bearer good-token' }, method = 'GET') {
  return { method, query, headers }
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
  vi.mocked(getUnreadArticlesForKeywords).mockResolvedValue([])
  vi.mocked(getCategories).mockResolvedValue([])
})

describe('GET /api/discover/feed', () => {
  it('rejects non-GET methods', async () => {
    const res = mockRes()
    await handler(mockReq({}, undefined, 'POST') as never, res as never)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('rejects requests with no Authorization header', async () => {
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1' }, {}) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad'))
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects a PENDING caller', async () => {
    verifyIdToken.mockResolvedValue({ role: 'PENDING', uid: 'caller-1' })
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('rejects a request missing articlesAppUid', async () => {
    const res = mockRes()
    await handler(mockReq({}) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('passes an empty keyword list through when none are configured (turso short-circuits to [])', async () => {
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1' }) as never, res as never)
    expect(getUnreadArticlesForKeywords).toHaveBeenCalledWith('uid-1', [], expect.anything())
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ articles: [] }))
  })

  it('parses comma-separated keywords and passes search/category through', async () => {
    const res = mockRes()
    await handler(mockReq({
      articlesAppUid: 'uid-1',
      keywords: 'woodworking,astronomy',
      search: 'chisel',
      category: 'DIY',
    }) as never, res as never)

    expect(getUnreadArticlesForKeywords).toHaveBeenCalledWith(
      'uid-1',
      ['woodworking', 'astronomy'],
      { search: 'chisel', category: 'DIY' },
    )
  })

  it('returns articles and categories together on success', async () => {
    vi.mocked(getUnreadArticlesForKeywords).mockResolvedValue([{ id: 1 } as never])
    vi.mocked(getCategories).mockResolvedValue(['DIY'])
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1', keywords: 'woodworking' }) as never, res as never)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ articles: [{ id: 1 }], categories: ['DIY'] })
  })
})
