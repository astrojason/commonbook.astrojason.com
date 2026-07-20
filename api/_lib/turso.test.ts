// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@libsql/client'
import { getUnreadArticlesForKeywords, getCategories, markArticleRead, updateArticleContent } from './turso'

const execute = vi.fn()

vi.mock('@libsql/client', () => ({
  createClient: vi.fn(() => ({ execute })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(createClient).mockReturnValue({ execute } as never)
  execute.mockResolvedValue({ rows: [] })
})

describe('getUnreadArticlesForKeywords', () => {
  it('returns [] without querying when no keywords are given', async () => {
    const result = await getUnreadArticlesForKeywords('uid-1', [])
    expect(result).toEqual([])
    expect(execute).not.toHaveBeenCalled()
  })

  it('queries with OR-ed LIKE clauses for each keyword', async () => {
    await getUnreadArticlesForKeywords('uid-1', ['woodworking', 'astronomy'])
    const call = execute.mock.calls[0][0]
    expect(call.sql).toContain('a.created_by_uid = ?')
    expect(call.sql).toContain('NOT EXISTS')
    expect((call.sql.match(/LOWER\(a\.search_terms\) LIKE LOWER\(\?\)/g) ?? []).length).toBe(2)
    expect(call.args).toEqual(expect.arrayContaining(['%woodworking%', '%astronomy%']))
  })

  it('adds a free-text search clause when search is provided', async () => {
    await getUnreadArticlesForKeywords('uid-1', ['woodworking'], { search: 'chisel' })
    const call = execute.mock.calls[0][0]
    expect(call.sql).toContain('LOWER(a.title) LIKE LOWER(?)')
    expect(call.args).toContain('%chisel%')
  })

  it('adds a category filter when category is provided', async () => {
    await getUnreadArticlesForKeywords('uid-1', ['woodworking'], { category: 'DIY' })
    const call = execute.mock.calls[0][0]
    expect(call.sql).toContain('user_article_category_article')
    expect(call.args).toContain('DIY')
  })

  it('maps rows into DiscoverArticle shape, parsing JSON search_terms and || categories', async () => {
    execute.mockResolvedValue({
      rows: [{
        id: 42,
        title: 'A Title',
        url: 'https://example.com/a',
        summary: 'A summary',
        reading_time: 5,
        search_terms: '["woodworking","tools"]',
        content: 'full text',
        created_timestamp: 1700000000,
        categories: 'DIY||Home',
      }],
    })
    const [article] = await getUnreadArticlesForKeywords('uid-1', ['woodworking'])
    expect(article).toEqual({
      id: 42,
      title: 'A Title',
      url: 'https://example.com/a',
      summary: 'A summary',
      readingTime: 5,
      searchTerms: ['woodworking', 'tools'],
      content: 'full text',
      createdAt: 1700000000,
      categories: ['DIY', 'Home'],
    })
  })

  it('handles empty categories string and malformed search_terms JSON gracefully', async () => {
    execute.mockResolvedValue({
      rows: [{
        id: 1, title: 't', url: 'u', summary: '', reading_time: 0,
        search_terms: 'not json', content: '', created_timestamp: 0, categories: '',
      }],
    })
    const [article] = await getUnreadArticlesForKeywords('uid-1', ['x'])
    expect(article.searchTerms).toEqual([])
    expect(article.categories).toEqual([])
  })
})

describe('getCategories', () => {
  it('queries distinct category names for the given articlesAppUid', async () => {
    execute.mockResolvedValue({ rows: [{ name: 'DIY' }, { name: 'Astronomy' }] })
    const result = await getCategories('uid-1')
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      args: ['uid-1'],
    }))
    expect(result).toEqual(['DIY', 'Astronomy'])
  })
})

describe('markArticleRead', () => {
  it('does nothing if the article is already marked read for this uid', async () => {
    execute.mockResolvedValueOnce({ rows: [{ count: 1 }] })
    await markArticleRead('uid-1', 42)
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('inserts a user_article_read row if not already read', async () => {
    execute.mockResolvedValueOnce({ rows: [{ count: 0 }] })
    execute.mockResolvedValueOnce({ rows: [] })
    await markArticleRead('uid-1', 42)
    expect(execute).toHaveBeenCalledTimes(2)
    const insertCall = execute.mock.calls[1][0]
    expect(insertCall.sql).toContain('INSERT INTO user_article_read')
    expect(insertCall.args.slice(0, 3)).toEqual([42, 'uid-1', 'uid-1'])
  })
})

describe('updateArticleContent', () => {
  it('updates the content column for the given article id', async () => {
    await updateArticleContent(42, 'full article text')
    expect(execute).toHaveBeenCalledWith({
      sql: expect.stringContaining('UPDATE article SET content = ? WHERE id = ?'),
      args: ['full article text', 42],
    })
  })
})
