import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToUser } from '../lib/users'
import {
  fetchDiscoverFeed,
  markArticleRead,
  ingestArticle,
  draftNote,
  NeedsManualPasteError,
  type DiscoverArticle,
} from '../lib/discover'
import { Chip } from '../components/Chip'
import { Tag } from '../components/Tag'
import { Spinner } from '../components/Spinner'
import { useToast } from '../contexts/ToastContext'

type BusyAction = 'skip' | 'promote' | 'paste' | null

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function Discover() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [settingsLoading, setSettingsLoading] = useState(true)
  const [articlesAppUid, setArticlesAppUid] = useState<string | null>(null)
  const [interestKeywords, setInterestKeywords] = useState<string[]>([])

  const [articles, setArticles] = useState<DiscoverArticle[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<BusyAction>(null)
  const isBusy = busyAction !== null
  const [manualPasteFor, setManualPasteFor] = useState<number | null>(null)
  const [pasteText, setPasteText] = useState('')

  useEffect(() => {
    if (!user) return
    return subscribeToUser(
      user.uid,
      appUser => {
        setArticlesAppUid(appUser?.articlesAppUid ?? null)
        setInterestKeywords(appUser?.interestKeywords ?? [])
        setSettingsLoading(false)
      },
      err => { setLoadError(err.message); setSettingsLoading(false) },
    )
  }, [user])

  useEffect(() => {
    if (settingsLoading || !user || !articlesAppUid || interestKeywords.length === 0) return
    let cancelled = false

    setFeedLoading(true)
    setLoadError(null)
    ;(async () => {
      try {
        const token = await user.getIdToken()
        const result = await fetchDiscoverFeed(token, articlesAppUid, interestKeywords, {
          search: search || undefined,
          category: category || undefined,
        })
        if (cancelled) return
        setArticles(result.articles)
        setCategories(result.categories)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setFeedLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [settingsLoading, user, articlesAppUid, interestKeywords, search, category])

  const current = articles[0]

  async function handleSkip() {
    if (!current || !user || !articlesAppUid) return
    setActionError(null)
    setBusyAction('skip')
    try {
      const token = await user.getIdToken()
      await markArticleRead(token, articlesAppUid, current.id)
      showToast('Article skipped', current.title)
      setArticles(prev => prev.filter(a => a.id !== current.id))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyAction(null)
    }
  }

  async function proceedToPromote(article: DiscoverArticle, content: string) {
    const draft = await draftNote(article.title, content)
    if (user && articlesAppUid) {
      const token = await user.getIdToken()
      await markArticleRead(token, articlesAppUid, article.id)
    }
    showToast('Article promoted', article.title)
    navigate('/capture', {
      state: {
        prefill: {
          title: article.title,
          tag: draft.tag,
          source_url: article.url,
          what_it_said: draft.what_it_said,
          why_it_matters: draft.why_it_matters,
          application: draft.application,
        },
      },
    })
  }

  async function handlePromote() {
    if (!current || !user) return
    setActionError(null)
    setBusyAction('promote')
    try {
      let content = current.content
      if (!content) {
        const token = await user.getIdToken()
        const result = await ingestArticle(token, current.id, { url: current.url })
        content = result.content
      }
      await proceedToPromote(current, content)
    } catch (err) {
      if (err instanceof NeedsManualPasteError) {
        setManualPasteFor(current.id)
      } else {
        setActionError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      setBusyAction(null)
    }
  }

  async function handleManualPasteSubmit() {
    if (!current || !user || !pasteText.trim()) return
    setActionError(null)
    setBusyAction('paste')
    try {
      const token = await user.getIdToken()
      const result = await ingestArticle(token, current.id, { pastedContent: pasteText.trim() })
      setManualPasteFor(null)
      setPasteText('')
      await proceedToPromote(current, result.content)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyAction(null)
    }
  }

  if (settingsLoading) return null

  if (!articlesAppUid || interestKeywords.length === 0) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="font-mono text-[13px] text-muted max-w-xs mx-auto">
          {!articlesAppUid
            ? 'Set your articles.astrojason.com UID in '
            : 'Add at least one interest keyword in '}
          <Link to="/settings" className="text-accent underline">
            Settings
          </Link>
          {' '}to start discovering articles.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 py-6 flex flex-col gap-5">
      <h1 className="font-mono text-[13px] tracking-[0.2em] uppercase font-medium">Discover</h1>

      {loadError && (
        <pre role="alert" className="font-mono text-[12px] text-accent whitespace-pre-wrap select-all border border-accent px-3 py-2">
          {loadError}
        </pre>
      )}
      {actionError && (
        <pre role="alert" className="font-mono text-[12px] text-accent whitespace-pre-wrap select-all border border-accent px-3 py-2">
          {actionError}
        </pre>
      )}

      <input
        type="text"
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput.trim()) }}
        placeholder="search title, summary, keywords…"
        className="font-mono text-[13px] bg-transparent border border-rule px-3 py-2 focus:border-accent outline-none"
      />

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCategory(null)}>
            <Chip active={category === null}>all</Chip>
          </button>
          {categories.map(c => (
            <button key={c} onClick={() => setCategory(c)}>
              <Chip active={category === c}>{c}</Chip>
            </button>
          ))}
        </div>
      )}

      {feedLoading && <p className="font-mono text-[12px] text-dim">Loading…</p>}

      {!feedLoading && !current && (
        <p className="font-mono text-[13px] text-muted">No articles match right now — check back later.</p>
      )}

      {current && (
        <div className="border border-rule px-4 py-4 flex flex-col gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-dim">
            {domainOf(current.url)} · {current.readingTime} min
          </div>
          <div className="font-mono text-[15px]">{current.title}</div>
          <p className="font-mono text-[13px] text-muted">{current.summary}</p>
          {current.categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {current.categories.map(c => <Tag key={c}>{c}</Tag>)}
            </div>
          )}

          {manualPasteFor === current.id ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="paste the full article text"
                rows={8}
                className="font-mono text-[13px] bg-transparent border border-rule px-3 py-2 focus:border-accent outline-none"
              />
              <button
                onClick={handleManualPasteSubmit}
                disabled={isBusy || !pasteText.trim()}
                className="self-start font-mono text-xs uppercase tracking-[0.18em] px-4 py-2 border border-accent text-accent disabled:opacity-50"
              >
                {busyAction === 'paste'
                  ? <span className="inline-flex items-center gap-2"><Spinner />Adding…</span>
                  : 'Use this text'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                disabled={isBusy}
                className="font-mono text-xs uppercase tracking-[0.18em] px-4 py-2 border border-[var(--rule-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
              >
                {busyAction === 'skip'
                  ? <span className="inline-flex items-center gap-2"><Spinner />Skipping…</span>
                  : 'Skip'}
              </button>
              <button
                onClick={handlePromote}
                disabled={isBusy}
                className="font-mono text-xs uppercase tracking-[0.18em] px-4 py-2 border border-accent text-accent disabled:opacity-50"
              >
                {busyAction === 'promote'
                  ? <span className="inline-flex items-center gap-2"><Spinner />Promoting…</span>
                  : 'Promote →'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
