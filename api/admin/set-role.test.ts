// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import handler from './set-role'

vi.mock('firebase-admin/app', () => ({
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn((x: unknown) => x),
}))
vi.mock('firebase-admin/auth', () => ({ getAuth: vi.fn() }))
vi.mock('firebase-admin/firestore', () => ({ getFirestore: vi.fn() }))

const verifyIdToken = vi.fn()
const getUser = vi.fn()
const setCustomUserClaims = vi.fn()
const docSet = vi.fn()

function mockReq(body: object, headers: Record<string, string> = { authorization: 'Bearer good-token' }, method = 'POST') {
  return { method, body, headers }
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY = '{"project_id":"test"}'
  vi.mocked(getApps).mockReturnValue([])
  vi.mocked(initializeApp).mockReturnValue({} as never)
  vi.mocked(getAuth).mockReturnValue({ verifyIdToken, getUser, setCustomUserClaims } as never)
  vi.mocked(getFirestore).mockReturnValue({ doc: () => ({ set: docSet }) } as never)
  verifyIdToken.mockResolvedValue({ role: 'ADMIN', uid: 'caller-1' })
  getUser.mockResolvedValue({ uid: 'target-1', customClaims: {} })
})

describe('POST /api/admin/set-role', () => {
  it('rejects non-POST methods', async () => {
    const res = mockRes()
    await handler(mockReq({}, undefined, 'GET') as never, res as never)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('rejects requests with no Authorization header', async () => {
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }, {}) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects an invalid/expired token', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad token'))
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejects a caller whose role is not ADMIN or SUPERADMIN', async () => {
    verifyIdToken.mockResolvedValue({ role: 'USER', uid: 'caller-1' })
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(setCustomUserClaims).not.toHaveBeenCalled()
  })

  it('allows a caller whose role is SUPERADMIN', async () => {
    verifyIdToken.mockResolvedValue({ role: 'SUPERADMIN', uid: 'caller-1' })
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('rejects missing targetUid or role in the body', async () => {
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects an unrecognized role string', async () => {
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'WIZARD' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('rejects any attempt to grant SUPERADMIN — it is not an assignable role', async () => {
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'SUPERADMIN' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(setCustomUserClaims).not.toHaveBeenCalled()
  })

  it('rejects any role change targeting an account that is already SUPERADMIN', async () => {
    getUser.mockResolvedValue({ uid: 'target-1', customClaims: { role: 'SUPERADMIN' } })
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(setCustomUserClaims).not.toHaveBeenCalled()
  })

  it('sets the custom claim and mirrors the role into Firestore on success', async () => {
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)

    expect(setCustomUserClaims).toHaveBeenCalledWith('target-1', { role: 'USER' })
    expect(docSet).toHaveBeenCalledWith({ role: 'USER' }, { merge: true })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('approves a PENDING account to USER', async () => {
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('demotes an ADMIN back to USER', async () => {
    getUser.mockResolvedValue({ uid: 'target-1', customClaims: { role: 'ADMIN' } })
    const res = mockRes()
    await handler(mockReq({ targetUid: 'target-1', role: 'USER' }) as never, res as never)
    expect(setCustomUserClaims).toHaveBeenCalledWith('target-1', { role: 'USER' })
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
