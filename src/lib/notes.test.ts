import { Timestamp } from 'firebase/firestore'
import { resolveLastReviewedAt } from './notes'

describe('resolveLastReviewedAt', () => {
  it('returns last_reviewed_at as-is when present', () => {
    const ts = Timestamp.fromDate(new Date('2026-06-01'))
    const result = resolveLastReviewedAt({
      last_reviewed_at: ts,
      session_count: 3,
      next_review_at: Timestamp.fromDate(new Date('2026-07-01')),
      interval_days: 6,
    })
    expect(result).toBe(ts)
  })

  it('returns null when the note has never been reviewed', () => {
    const result = resolveLastReviewedAt({
      last_reviewed_at: null,
      session_count: 0,
      next_review_at: Timestamp.fromDate(new Date('2026-06-02')),
      interval_days: 1,
    })
    expect(result).toBeNull()
  })

  it('backfills an approximate date from next_review_at - interval_days when missing', () => {
    const result = resolveLastReviewedAt({
      last_reviewed_at: null,
      session_count: 2,
      next_review_at: Timestamp.fromDate(new Date('2026-06-10')),
      interval_days: 6,
    })
    expect(result).not.toBeNull()
    expect(result!.toDate().toISOString().slice(0, 10)).toBe('2026-06-04')
  })
})
