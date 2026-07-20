import { getApps, initializeApp, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { scrapeArticleFullText } from '../_lib/scrapeArticle'
import { updateArticleContent } from '../_lib/turso'

type Role = 'PENDING' | 'USER' | 'ADMIN' | 'SUPERADMIN'

interface IngestRequest {
  articleId?: number
  url?: string
  pastedContent?: string
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

/**
 * Ensures full article text is available for drafting: uses pastedContent if the
 * caller supplied it (manual fallback), otherwise runs the tiered scraper. Either
 * way, successful content is persisted to article.content so it's never re-fetched.
 * Returns 422 (not an error the caller can retry automatically) when scraping fails
 * and no pastedContent was given — the client should show the manual-paste UI.
 */
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

  const { articleId, url, pastedContent } = (req.body ?? {}) as IngestRequest
  if (!articleId) {
    res.status(400).json({ error: 'Missing articleId' })
    return
  }
  if (!url && !pastedContent) {
    res.status(400).json({ error: 'Missing url or pastedContent' })
    return
  }

  if (pastedContent) {
    await updateArticleContent(articleId, pastedContent)
    res.status(200).json({ content: pastedContent, scraped: false })
    return
  }

  const scraped = await scrapeArticleFullText(url as string)
  if (!scraped) {
    res.status(422).json({ error: 'Could not scrape this article — paste the text manually' })
    return
  }

  await updateArticleContent(articleId, scraped)
  res.status(200).json({ content: scraped, scraped: true })
}
