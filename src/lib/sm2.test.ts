import { computeSM2 } from './sm2'

const base = { rating: 4, intervalDays: 6, easinessFactor: 2.5, sessionCount: 2 }

describe('computeSM2', () => {
  describe('rating < 3', () => {
    it('sets interval to 1', () => {
      expect(computeSM2({ ...base, rating: 2 }).intervalDays).toBe(1)
    })

    it('decrements EF by 0.2', () => {
      expect(computeSM2({ ...base, rating: 2 }).easinessFactor).toBeCloseTo(2.3)
    })

    it('floors EF at 1.3', () => {
      expect(computeSM2({ ...base, rating: 2, easinessFactor: 1.4 }).easinessFactor).toBe(1.3)
      expect(computeSM2({ ...base, rating: 1, easinessFactor: 1.3 }).easinessFactor).toBe(1.3)
    })
  })

  describe('rating >= 3 — interval by session count', () => {
    it('first session (count=0): interval=1', () => {
      expect(computeSM2({ ...base, sessionCount: 0 }).intervalDays).toBe(1)
    })

    it('second session (count=1): interval=6', () => {
      expect(computeSM2({ ...base, sessionCount: 1 }).intervalDays).toBe(6)
    })

    it('subsequent sessions: interval=round(intervalDays * EF)', () => {
      // 6 * 2.5 = 15
      expect(computeSM2({ ...base, sessionCount: 2 }).intervalDays).toBe(15)
      // 15 * 2.5 = 37.5 → 38
      expect(computeSM2({ rating: 4, intervalDays: 15, easinessFactor: 2.5, sessionCount: 5 }).intervalDays).toBe(38)
    })
  })

  describe('rating >= 3 — EF adjustment', () => {
    it('rating 5: EF increases by 0.1', () => {
      // EF + (0.1 - 0 * ...) = EF + 0.1
      expect(computeSM2({ ...base, rating: 5 }).easinessFactor).toBeCloseTo(2.6)
    })

    it('rating 4: EF increases slightly', () => {
      // EF + (0.1 - 1*(0.08 + 1*0.02)) = EF + (0.1 - 0.1) = EF + 0
      expect(computeSM2({ ...base, rating: 4 }).easinessFactor).toBeCloseTo(2.5)
    })

    it('rating 3: EF decreases slightly', () => {
      // EF + (0.1 - 2*(0.08 + 2*0.02)) = EF + (0.1 - 0.24) = EF - 0.14
      expect(computeSM2({ ...base, rating: 3 }).easinessFactor).toBeCloseTo(2.36)
    })

    it('EF floors at 1.3 when rating >= 3', () => {
      // EF = 1.35, rating = 3: 1.35 - 0.14 = 1.21 → floor to 1.3
      expect(computeSM2({ ...base, rating: 3, easinessFactor: 1.35 }).easinessFactor).toBe(1.3)
    })
  })

  describe('session count and next review', () => {
    it('always increments sessionCount by 1', () => {
      expect(computeSM2({ ...base, sessionCount: 0 }).sessionCount).toBe(1)
      expect(computeSM2({ ...base, sessionCount: 4 }).sessionCount).toBe(5)
    })

    it('nextReviewAt is midnight on the target day', () => {
      const result = computeSM2(base)
      expect(result.nextReviewAt.getHours()).toBe(0)
      expect(result.nextReviewAt.getMinutes()).toBe(0)
      expect(result.nextReviewAt.getSeconds()).toBe(0)
      expect(result.nextReviewAt.getMilliseconds()).toBe(0)
    })

    it('nextReviewAt is exactly intervalDays days from today midnight', () => {
      const result = computeSM2({ ...base, sessionCount: 1 }) // interval=6
      const expected = new Date()
      expected.setHours(0, 0, 0, 0)
      expected.setDate(expected.getDate() + 6)
      expect(result.nextReviewAt.getTime()).toBe(expected.getTime())
    })
  })
})
