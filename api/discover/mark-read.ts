import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { markArticleRead } from '../_lib/turso'

type Role = 'PENDING' | 'USER' | 'ADMIN' | 'SUPERADMIN'

interface MarkReadRequest {
  articlesAppUid?: string
  articleId?: number
}

interface Req {
  method: string
  body: unknown
  headers: Record<string, string | string[] | undefined>
}

interface Res {
  status(code: number): Res
  json(data: unknown): void
}

function getAdminApp(): App {
  const apps = getApps()
  if (apps.length) return apps[0]
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? '{}')
  return initializeApp({ credential: cert(serviceAccount) })
}

function hasAppAccess(role: Role | undefined): boolean {
  return role === 'USER' || role === 'ADMIN' || role === 'SUPERADMIN'
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization
  const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : undefined
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }

  const app = getAdminApp()
  let callerClaims: { role?: Role }
  try {
    callerClaims = await getAuth(app).verifyIdToken(token)
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  if (!hasAppAccess(callerClaims.role)) {
    res.status(403).json({ error: 'Account not approved' })
    return
  }

  const { articlesAppUid, articleId } = (req.body ?? {}) as MarkReadRequest
  if (!articlesAppUid || !articleId) {
    res.status(400).json({ error: 'Missing articlesAppUid or articleId' })
    return
  }

  await markArticleRead(articlesAppUid, articleId)
  res.status(200).json({ ok: true })
}
