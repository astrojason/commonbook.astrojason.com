import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Note, CreateNoteInput } from '../types'
import type { SM2Result } from './sm2'

function toNote(id: string, data: Record<string, unknown>): Note {
  return { id, ...data } as Note
}

export async function createNote(input: CreateNoteInput): Promise<string> {
  const nextReview = new Date()
  nextReview.setHours(0, 0, 0, 0)
  nextReview.setDate(nextReview.getDate() + 1)

  const ref = await addDoc(collection(db, 'notes'), {
    ...input,
    created_at: serverTimestamp(),
    next_review_at: Timestamp.fromDate(nextReview),
    interval_days: 1,
    easiness_factor: 2.5,
    session_count: 0,
    last_rating: null,
    deleted_at: null,
  })
  return ref.id
}

export async function updateNote(id: string, input: CreateNoteInput): Promise<void> {
  await updateDoc(doc(db, 'notes', id), { ...input })
}

export async function softDeleteNote(id: string): Promise<void> {
  await updateDoc(doc(db, 'notes', id), { deleted_at: serverTimestamp() })
}

export async function getNoteById(id: string): Promise<Note | null> {
  const snap = await getDoc(doc(db, 'notes', id))
  if (!snap.exists()) return null
  return toNote(snap.id, snap.data())
}

export async function updateNoteAfterRating(id: string, sm2: SM2Result, rating: number): Promise<void> {
  await updateDoc(doc(db, 'notes', id), {
    interval_days: sm2.intervalDays,
    easiness_factor: sm2.easinessFactor,
    session_count: sm2.sessionCount,
    next_review_at: Timestamp.fromDate(sm2.nextReviewAt),
    last_rating: rating,
  })
}

export function subscribeToNotes(
  callback: (notes: Note[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, 'notes'),
    where('deleted_at', '==', null),
  )
  return onSnapshot(
    q,
    snapshot => { callback(snapshot.docs.map(d => toNote(d.id, d.data()))) },
    err => { onError?.(err) },
  )
}
