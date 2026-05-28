import type { Note } from '../types'
import { getUniqueTags } from './tags'

function makeNotes(tags: string[]): Note[] {
  return tags.map(tag => ({ tag }) as Note)
}

describe('getUniqueTags', () => {
  it('returns a deduplicated sorted list', () => {
    const notes = makeNotes(['probability', 'design', 'probability', 'engineering'])
    expect(getUniqueTags(notes)).toEqual(['design', 'engineering', 'probability'])
  })

  it('returns empty array for empty input', () => {
    expect(getUniqueTags([])).toEqual([])
  })

  it('sorts alphabetically', () => {
    const notes = makeNotes(['zzz', 'aaa', 'mmm'])
    expect(getUniqueTags(notes)).toEqual(['aaa', 'mmm', 'zzz'])
  })

  it('deduplicates across many duplicates', () => {
    const notes = makeNotes(['a', 'a', 'a', 'b'])
    expect(getUniqueTags(notes)).toEqual(['a', 'b'])
  })

  it('handles a single note', () => {
    expect(getUniqueTags(makeNotes(['databases']))).toEqual(['databases'])
  })
})
