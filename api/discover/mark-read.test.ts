// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { markArticleRead } from '../_lib/turso'
import handler from './mark-read'

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn((x: unknown) => x),
}))
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn() }))
vi.mock('../_lib/turso', () => ({ markArticleRead: vi.fn() }))

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
  vi.mocked(markArticleRead).mockResolvedValue(undefined)
})

describe('POST /api/discover/mark-read', () => {
  it('rejects non-POST methods', async () => {
    const res = mockRes()
    await handler(mockReq({}, undefined, 'GET') as never, res as never)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('rejects requests with no Authorization header', async () => {
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1', articleId: 1 }, {}) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects an invalid token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad'))
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1', articleId: 1 }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects a PENDING caller', async () => {
    verifyIdToken.mockResolvedValue({ role: 'PENDING', uid: 'caller-1' })
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1', articleId: 1 }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('rejects a request missing articlesAppUid or articleId', async () => {
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('marks the article read and returns 200 on success', async () => {
    const res = mockRes()
    await handler(mockReq({ articlesAppUid: 'uid-1', articleId: 42 }) as never, res as never)
    expect(markArticleRead).toHaveBeenCalledWith('uid-1', 42)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })
})
