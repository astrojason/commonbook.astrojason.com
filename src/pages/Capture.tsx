import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CaptureForm } from '../components/CaptureForm'
import { createNote, getNoteById, subscribeToNotes, updateNote } from '../lib/notes'
import { incrementStats } from '../lib/stats'
import { getUniqueTags } from '../lib/tags'
import type { CreateNoteInput, Note } from '../types'

export default function Capture() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const editId = searchParams.get('edit')

  const [notes, setNotes] = useState<Note[]>([])
  const [initialValues, setInitialValues] = useState<Partial<CreateNoteInput> | undefined>()
  const [loading, setLoading] = useState(!!editId)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    return subscribeToNotes(setNotes)
  }, [])

  useEffect(() => {
    if (!editId) return
    getNoteById(editId).then(note => {
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
  }, [editId])

  async function handleSubmit(values: CreateNoteInput) {
    setIsSubmitting(true)
    try {
      if (editId) {
        await updateNote(editId, values)
        navigate(`/note/${editId}`)
      } else {
        const id = await createNote(values)
        await incrementStats({ total_notes: 1 })
        navigate(`/note/${id}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return null

  return (
    <CaptureForm
      initialValues={initialValues}
      existingTags={getUniqueTags(notes)}
      onSubmit={handleSubmit}
      onCancel={() => navigate(-1)}
      submitLabel={editId ? 'Save changes →' : 'Save entry →'}
      isSubmitting={isSubmitting}
    />
  )
}
