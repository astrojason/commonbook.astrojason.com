import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Session, Message } from '../types'

function toSession(id: string, data: Record<string, unknown>): Session {
  return { id, ...data } as Session
}

export async function getSessionById(id: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, 'sessions', id))
  if (!snap.exists()) return null
  return toSession(snap.id, snap.data())
}

export async function createSession(noteId: string): Promise<string> {
  const ref = await addDoc(collection(db, 'sessions'), {
    note_id: noteId,
    messages: [],
    completed_at: null,
    self_rating: null,
  })
  return ref.id
}

export async function updateSession(
  id: string,
  data: { messages?: Message[]; completed_at?: Date | null; self_rating?: number | null },
): Promise<void> {
  await updateDoc(doc(db, 'sessions', id), { ...data })
}

export async function getIncompleteSession(noteId: string): Promise<Session | null> {
  const q = query(
    collection(db, 'sessions'),
    where('note_id', '==', noteId),
    where('completed_at', '==', null),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return toSession(d.id, d.data())
}
