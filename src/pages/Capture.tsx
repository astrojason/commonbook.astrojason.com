import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { CaptureForm } from '../components/CaptureForm'
import { createNote, getNoteById, subscribeToNotes, updateNote } from '../lib/notes'
import { incrementStats } from '../lib/stats'
import { getUniqueTags } from '../lib/tags'
import type { CreateNoteInput, Note } from '../types'

export default function Capture() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const editId = searchParams.get('edit')
  const statePrefill = (location.state as { prefill?: Partial<CreateNoteInput> } | null)?.prefill

  const [notes, setNotes] = useState<Note[]>([])
  const [initialValues, setInitialValues] = useState<Partial<CreateNoteInput> | undefined>(statePrefill)
  const [loading, setLoading] = useState(!!editId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    return subscribeToNotes(setNotes, err => setLoadError(err.message))
  }, [])

  useEffect(() => {
    if (!editId) return
    getNoteById(editId)
      .then(note => {
        if (note) {
          setInitialValues({
            title: note.title,
            tag: note.tag,
            source_url: note.source_url,
            what_it_said: note.what_it_said,
            why_it_matters: note.why_it_matters,
            application: note.application,
          })
        }
        setLoading(false)
      })
      .catch(err => {
        setLoadError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [editId])

  async function handleSubmit(values: CreateNoteInput) {
    if (!navigator.onLine) {
      setSaveError('No internet connection — reconnect and try again')
      return
    }
    setIsSubmitting(true)
    setSaveError(null)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Save timed out — Firestore did not respond. Reload the page and try again.')), 12_000)
    )
    try {
      if (editId) {
        await Promise.race([updateNote(editId, values), timeout])
        navigate(`/note/${editId}`)
      } else {
        const id = await Promise.race([createNote(values), timeout])
        incrementStats({ total_notes: 1 }).catch(err => {
          console.error('Stats increment failed:', err)
        })
        navigate(`/note/${id}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSaveError(msg || 'Save failed — unknown error')
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
    <>
      {saveError && (
        <pre role="alert" className="mx-5 mt-4 font-mono text-[12px] text-accent whitespace-pre-wrap select-all border border-accent px-3 py-2">
          {saveError}
        </pre>
      )}
      <CaptureForm
        initialValues={initialValues}
        existingTags={getUniqueTags(notes)}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        submitLabel={editId ? 'Save changes →' : 'Save entry →'}
        isSubmitting={isSubmitting}
      />
    </>
  )
}
