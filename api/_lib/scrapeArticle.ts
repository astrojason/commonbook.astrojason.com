// Full-text article scraper for Discover's promote-time ingestion.
//
// Mirrors articles.astrojason.com's tiered strategy (direct fetch -> Jina Reader ->
// ScraperAPI, same SCRAPER_API_KEY) but extracts full body text rather than a short
// excerpt — that app only ever stores a meta-level summary, which isn't enough
// substance for a real spaced-repetition note (see CLAUDE.md's Discover section).

const MIN_CONTENT_LENGTH = 200

function stripHtml(html: string): string {
  const withoutScriptsAndStyles = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
  const withoutTags = withoutScriptsAndStyles.replace(/<[^>]+>/g, ' ')
  const decoded = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return decoded.replace(/\s+/g, ' ').trim()
}

async function scrapeDirect(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    if (!res.ok) return null
    const text = stripHtml(await res.text())
    return text.length >= MIN_CONTENT_LENGTH ? text : null
  } catch {
    return null
  }
}

async function scrapeJina(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
    })
    if (!res.ok) return null
    const text = (await res.text()).trim()
    return text.length >= MIN_CONTENT_LENGTH ? text : null
  } catch {
    return null
  }
}

async function scrapeScraperApi(url: string): Promise<string | null> {
  const apiKey = process.env.SCRAPER_API_KEY
  if (!apiKey) return null
  try {
    const endpoint = `https://api.scraperapi.com/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(url)}&render=true`
    const res = await fetch(endpoint, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
    })
    if (!res.ok) return null
    const text = stripHtml(await res.text())
    return text.length >= MIN_CONTENT_LENGTH ? text : null
  } catch {
    return null
  }
}

/** Returns full article body text, or null if every tier failed (caller should offer a manual-paste fallback). */
export async function scrapeArticleFullText(url: string): Promise<string | null> {
  const direct = await scrapeDirect(url)
  if (direct) return direct

  const jina = await scrapeJina(url)
  if (jina) return jina

  return scrapeScraperApi(url)
}
