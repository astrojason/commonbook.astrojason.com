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

export interface DiscoverFeedResult {
  articles: DiscoverArticle[]
  categories: string[]
}

export interface DiscoverFeedOptions {
  search?: string
  category?: string
}

export interface IngestResult {
  content: string
  scraped: boolean
}

export interface DraftNoteResult {
  tag: string
  what_it_said: string
  why_it_matters: string
  application: string
}

/** Thrown by ingestArticle when auto-scraping failed and the caller should show a manual-paste UI. */
export class NeedsManualPasteError extends Error {}

async function extractError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({}))
  return (data as { error?: string }).error || `Request failed (${res.status})`
}

export async function fetchDiscoverFeed(
  token: string,
  articlesAppUid: string,
  keywords: string[],
  opts: DiscoverFeedOptions = {},
): Promise<DiscoverFeedResult> {
  const params = new URLSearchParams({ articlesAppUid })
  if (keywords.length) params.set('keywords', keywords.join(','))
  if (opts.search) params.set('search', opts.search)
  if (opts.category) params.set('category', opts.category)

  const res = await fetch(`/api/discover/feed?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(await extractError(res))
  return res.json()
}

export async function markArticleRead(token: string, articlesAppUid: string, articleId: number): Promise<void> {
  const res = await fetch('/api/discover/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ articlesAppUid, articleId }),
  })
  if (!res.ok) throw new Error(await extractError(res))
}

export async function ingestArticle(
  token: string,
  articleId: number,
  opts: { url?: string; pastedContent?: string },
): Promise<IngestResult> {
  const res = await fetch('/api/discover/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ articleId, ...opts }),
  })
  if (res.status === 422) throw new NeedsManualPasteError(await extractError(res))
  if (!res.ok) throw new Error(await extractError(res))
  return res.json()
}

export async function draftNote(title: string, content: string): Promise<DraftNoteResult> {
  const res = await fetch('/api/draft-note', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content }),
  })
  if (!res.ok) throw new Error(await extractError(res))
  return res.json()
}
