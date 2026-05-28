import type { Timestamp } from 'firebase/firestore'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface Note {
  id: string
  title: string
  tag: string
  source_url: string | null
  what_it_said: string
  why_it_matters: string
  application: string
  created_at: Timestamp
  next_review_at: Timestamp
  interval_days: number
  easiness_factor: number
  session_count: number
  last_rating: number | null
  deleted_at: Timestamp | null
}

export interface Session {
  id: string
  note_id: string
  messages: Message[]
  completed_at: Timestamp | null
  self_rating: number | null
}

export interface Stats {
  total_sessions: number
  passing_sessions: number
  total_notes: number
}

export interface CreateNoteInput {
  title: string
  tag: string
  source_url: string | null
  what_it_said: string
  why_it_matters: string
  application: string
}
