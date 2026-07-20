import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Role } from './roles'

export interface AppUser {
  uid: string
  email: string | null
  displayName: string | null
  role: Role
  articlesAppUid: string | null
  interestKeywords: string[]
}

function toAppUser(uid: string, data: Record<string, unknown>): AppUser {
  return {
    uid,
    email: (data.email as string | null) ?? null,
    displayName: (data.displayName as string | null) ?? null,
    role: (data.role as Role) ?? 'PENDING',
    articlesAppUid: (data.articlesAppUid as string | null) ?? null,
    interestKeywords: (data.interestKeywords as string[]) ?? [],
  }
}

/** Idempotent — creates the users/{uid} onboarding doc on first sign-in. Never touches role on repeat calls. */
export async function ensureUserDoc(uid: string, email: string | null, displayName: string | null): Promise<void> {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return

  await setDoc(ref, {
    email,
    displayName,
    role: 'PENDING',
    articlesAppUid: null,
    interestKeywords: [],
    createdAt: serverTimestamp(),
  })
}

export function subscribeToUsers(
  callback: (users: AppUser[]) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'users'),
    snapshot => { callback(snapshot.docs.map(d => toAppUser(d.id, d.data()))) },
    err => { onError?.(err) },
  )
}

export function subscribeToUser(
  uid: string,
  callback: (user: AppUser | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'users', uid),
    snapshot => { callback(snapshot.exists() ? toAppUser(snapshot.id, snapshot.data()) : null) },
    err => { onError?.(err) },
  )
}

export async function updateUserSettings(
  uid: string,
  settings: { articlesAppUid: string | null; interestKeywords: string[] },
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), settings)
}
