import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getUnreadArticlesForKeywords, getCategories } from '../_lib/turso'

type Role = 'PENDING' | 'USER' | 'ADMIN' | 'SUPERADMIN'

interface Req {
  method: string
  query: Record<string, string | string[] | undefined>
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

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'GET') {
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

  const articlesAppUid = firstParam(req.query.articlesAppUid)
  if (!articlesAppUid) {
    res.status(400).json({ error: 'Missing articlesAppUid' })
    return
  }

  const keywordsParam = firstParam(req.query.keywords)
  const keywords = keywordsParam ? keywordsParam.split(',').map(k => k.trim()).filter(Boolean) : []
  const search = firstParam(req.query.search)
  const category = firstParam(req.query.category)

  const [articles, categories] = await Promise.all([
    getUnreadArticlesForKeywords(articlesAppUid, keywords, { search, category }),
    getCategories(articlesAppUid),
  ])

  res.status(200).json({ articles, categories })
}
