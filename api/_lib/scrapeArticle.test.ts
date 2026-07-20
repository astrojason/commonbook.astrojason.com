// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scrapeArticleFullText } from './scrapeArticle'

const LONG_TEXT = 'word '.repeat(60) // > 200 chars once expanded

function htmlResponse(body: string, ok = true) {
  return { ok, text: async () => body }
}

function textResponse(body: string, ok = true) {
  return { ok, text: async () => body }
}

beforeEach(() => {
  vi.restoreAllMocks()
  delete process.env.SCRAPER_API_KEY
})

describe('scrapeArticleFullText', () => {
  it('returns direct-fetch text when the page has substantial content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(htmlResponse(`<html><body><p>${LONG_TEXT}</p></body></html>`))
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')

    expect(result).toContain('word')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('strips script and style tags before measuring content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      htmlResponse(`<html><head><style>.x{color:red}</style></head><body><script>evil()</script><p>${LONG_TEXT}</p></body></html>`)
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')

    expect(result).not.toContain('evil()')
    expect(result).not.toContain('color:red')
  })

  it('falls back to Jina Reader when direct fetch fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce(textResponse(LONG_TEXT))
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')

    expect(result).toContain('word')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://r.jina.ai/https://example.com/a')
  })

  it('falls back to Jina Reader when direct fetch returns too little content', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(htmlResponse('<html><body><p>too short</p></body></html>'))
      .mockResolvedValueOnce(textResponse(LONG_TEXT))
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')
    expect(result).toContain('word')
  })

  it('falls back to ScraperAPI when direct and Jina both fail, using SCRAPER_API_KEY', async () => {
    process.env.SCRAPER_API_KEY = 'test-key'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce(htmlResponse(`<html><body><p>${LONG_TEXT}</p></body></html>`))
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')

    expect(result).toContain('word')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[2][0]).toContain('api.scraperapi.com')
    expect(fetchMock.mock.calls[2][0]).toContain('test-key')
  })

  it('skips ScraperAPI entirely when SCRAPER_API_KEY is not set', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
      .mockResolvedValueOnce({ ok: false, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null when every tier fails', async () => {
    process.env.SCRAPER_API_KEY = 'test-key'
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')
    expect(result).toBeNull()
  })

  it('returns null when a tier throws instead of failing gracefully', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await scrapeArticleFullText('https://example.com/a')
    expect(result).toBeNull()
  })
})
