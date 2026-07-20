import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { subscribeToUser, updateUserSettings } from '../lib/users'

export default function Settings() {
  const { user } = useAuth()
  const [articlesAppUid, setArticlesAppUid] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [newKeyword, setNewKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    return subscribeToUser(
      user.uid,
      appUser => {
        setArticlesAppUid(appUser?.articlesAppUid ?? '')
        setKeywords(appUser?.interestKeywords ?? [])
        setLoading(false)
      },
      err => { setLoadError(err.message); setLoading(false) },
    )
  }, [user])

  function addKeyword() {
    const trimmed = newKeyword.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed])
    }
    setNewKeyword('')
  }

  function removeKeyword(keyword: string) {
    setKeywords(keywords.filter(k => k !== keyword))
  }

  async function handleSave() {
    if (!user) return
    setSaveError(null)
    setIsSubmitting(true)
    try {
      await updateUserSettings(user.uid, {
        articlesAppUid: articlesAppUid.trim() || null,
        interestKeywords: keywords,
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return null
  if (loadError) {
    return (
      <pre role="alert" className="px-5 pt-8 font-mono text-[12px] text-accent whitespace-pre-wrap select-all">
        {loadError}
      </pre>
    )
  }

  return (
    <div className="px-5 py-6 flex flex-col gap-6">
      <h1 className="font-mono text-[13px] tracking-[0.2em] uppercase font-medium">Settings</h1>

      {saveError && (
        <pre role="alert" className="font-mono text-[12px] text-accent whitespace-pre-wrap select-all border border-accent px-3 py-2">
          {saveError}
        </pre>
      )}

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          articles.astrojason.com UID
        </span>
        <input
          type="text"
          value={articlesAppUid}
          onChange={e => setArticlesAppUid(e.target.value)}
          className="font-mono text-[13px] bg-transparent border border-rule px-3 py-2 focus:border-accent outline-none"
          placeholder="your uid in the articles-245214 Firebase project"
        />
      </label>

      <div className="flex flex-col gap-2">
        <label htmlFor="add-keyword" className="font-mono text-[11px] uppercase tracking-[0.18em] text-dim">
          Interest keywords — Discover only shows unread articles matching one of these
        </label>
        <input
          id="add-keyword"
          aria-label="add keyword"
          type="text"
          value={newKeyword}
          onChange={e => setNewKeyword(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addKeyword()
            }
          }}
          className="font-mono text-[13px] bg-transparent border border-rule px-3 py-2 focus:border-accent outline-none"
          placeholder="type a keyword and press enter"
        />
        <div className="flex flex-wrap gap-2 mt-1">
          {keywords.map(keyword => (
            <span
              key={keyword}
              className="font-mono text-[11px] uppercase tracking-[0.1em] border border-rule-2 px-2 py-1 flex items-center gap-2"
            >
              {keyword}
              <button
                type="button"
                aria-label={`remove ${keyword}`}
                onClick={() => removeKeyword(keyword)}
                className="text-muted hover:text-accent"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSubmitting}
        className="self-start font-mono text-xs uppercase tracking-[0.18em] px-6 py-3 border border-[var(--rule-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
      >
        Save
      </button>
    </div>
  )
}
