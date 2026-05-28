import { doc, getDoc, setDoc, increment } from 'firebase/firestore'
import { db } from '../firebase'
import type { Stats } from '../types'

const statsRef = () => doc(db, 'meta', 'stats')

export async function getStats(): Promise<Stats | null> {
  const snap = await getDoc(statsRef())
  if (!snap.exists()) return null
  return snap.data() as Stats
}

export async function incrementStats(updates: {
  total_notes?: number
  total_sessions?: number
  passing_sessions?: number
}): Promise<void> {
  const data: Record<string, ReturnType<typeof increment>> = {}
  if (updates.total_notes) data.total_notes = increment(updates.total_notes)
  if (updates.total_sessions) data.total_sessions = increment(updates.total_sessions)
  if (updates.passing_sessions) data.passing_sessions = increment(updates.passing_sessions)
  await setDoc(statsRef(), data, { merge: true })
}

export async function decrementNoteCount(): Promise<void> {
  await setDoc(statsRef(), { total_notes: increment(-1) }, { merge: true })
}
