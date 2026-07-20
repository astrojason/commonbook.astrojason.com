import { createClient, type Client, type Row } from '@libsql/client'

// Direct read/write access to articles.astrojason.com's shared Turso DB — no HTTP
// call into that app's Go backend. Schema (article, user_article_read,
// user_article_category, user_article_category_article) mirrors the queries in
// articles.astrojason.com/backend/internal/handlers/{library,read,categories}.go.

let client: Client | null = null

function getClient(): Client {
  if (client) return client
  client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? '',
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
  return client
}

export interface DiscoverArticle {
  id: number
  title: string
  url: string
  summary: string
  readingTime: number
  searchTerms: string[]
  categories: string[]
  content: string
  createdAt: number
}

function rowToArticle(row: Row): DiscoverArticle {
  let searchTerms: string[] = []
  try {
    const parsed = JSON.parse(String(row.search_terms ?? '[]'))
    if (Array.isArray(parsed)) searchTerms = parsed
  } catch {
    searchTerms = []
  }

  const categoriesStr = String(row.categories ?? '')

  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    url: String(row.url ?? ''),
    summary: String(row.summary ?? ''),
    readingTime: Number(row.reading_time ?? 0),
    searchTerms,
    categories: categoriesStr ? categoriesStr.split('||') : [],
    content: String(row.content ?? ''),
    createdAt: Number(row.created_timestamp ?? 0),
  }
}

export interface DiscoverFilterOptions {
  search?: string
  category?: string
}

/** Unread articles for articlesAppUid matching at least one of `keywords` against search_terms. */
export async function getUnreadArticlesForKeywords(
  articlesAppUid: string,
  keywords: string[],
  opts: DiscoverFilterOptions = {},
): Promise<DiscoverArticle[]> {
  if (keywords.length === 0) return []

  const keywordClauses = keywords.map(() => 'LOWER(a.search_terms) LIKE LOWER(?)').join(' OR ')
  const keywordArgs = keywords.map(k => `%${k}%`)

  let extraSql = ''
  const extraArgs: unknown[] = []

  if (opts.search) {
    const pattern = `%${opts.search}%`
    extraSql += ' AND (LOWER(a.title) LIKE LOWER(?) OR LOWER(a.summary) LIKE LOWER(?) OR LOWER(a.search_terms) LIKE LOWER(?))'
    extraArgs.push(pattern, pattern, pattern)
  }

  if (opts.category) {
    extraSql += `
      AND EXISTS (
        SELECT 1 FROM user_article_category_article uaca
        JOIN user_article_category uac ON uac.id = uaca.user_article_category_id
        WHERE uaca.article_id = a.id AND uaca.created_by_uid = ? AND uac.name = ?
      )`
    extraArgs.push(articlesAppUid, opts.category)
  }

  const sql = `
    SELECT
      a.id,
      a.title,
      a.url,
      COALESCE(a.summary, '') as summary,
      COALESCE(a.reading_time, 0) as reading_time,
      COALESCE(a.search_terms, '[]') as search_terms,
      COALESCE(a.content, '') as content,
      a.created_timestamp,
      COALESCE((
        SELECT GROUP_CONCAT(uac.name, '||')
        FROM user_article_category_article uaca
        JOIN user_article_category uac ON uac.id = uaca.user_article_category_id
        WHERE uaca.article_id = a.id AND uaca.created_by_uid = ?
      ), '') as categories
    FROM article a
    WHERE a.created_by_uid = ?
      AND NOT EXISTS (
        SELECT 1 FROM user_article_read
        WHERE article_id = a.id AND created_by_uid = ?
      )
      AND (${keywordClauses})
      ${extraSql}
    ORDER BY a.created_timestamp DESC
  `

  const args = [articlesAppUid, articlesAppUid, articlesAppUid, ...keywordArgs, ...extraArgs]
  const result = await getClient().execute({ sql, args })
  return result.rows.map(rowToArticle)
}

export async function getCategories(articlesAppUid: string): Promise<string[]> {
  const result = await getClient().execute({
    sql: 'SELECT name FROM user_article_category WHERE created_by_uid = ? ORDER BY name',
    args: [articlesAppUid],
  })
  return result.rows.map(row => String(row.name))
}

/** Persists scraped/pasted full text so future promotes/reads never re-scrape this article. */
export async function updateArticleContent(articleId: number, content: string): Promise<void> {
  await getClient().execute({
    sql: 'UPDATE article SET content = ? WHERE id = ?',
    args: [content, articleId],
  })
}

/** Idempotent — inserts a user_article_read row only if one doesn't already exist for this article/uid. */
export async function markArticleRead(articlesAppUid: string, articleId: number): Promise<void> {
  const existing = await getClient().execute({
    sql: 'SELECT COUNT(*) as count FROM user_article_read WHERE article_id = ? AND created_by_uid = ?',
    args: [articleId, articlesAppUid],
  })
  const count = Number(existing.rows[0]?.count ?? 0)
  if (count > 0) return

  const now = Math.floor(Date.now() / 1000)
  await getClient().execute({
    sql: `INSERT INTO user_article_read
      (article_id, created_by_uid, updated_by_uid, flagged_for_deletion, created_timestamp, updated_timestamp)
      VALUES (?, ?, ?, 0, ?, ?)`,
    args: [articleId, articlesAppUid, articlesAppUid, now, now],
  })
}
