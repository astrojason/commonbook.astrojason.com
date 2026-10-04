import { describe, it, expect } from 'vitest'
import { tokenize, focalIndex } from './rsvp'

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('one  two\nthree\n\nfour')).toEqual(['one', 'two', 'three', 'four'])
  })

  it('strips markdown syntax but keeps the words', () => {
    expect(tokenize('## Head\n- **bold** and `code`\n> [link](http://x.com) text')).toEqual(
      ['Head', 'bold', 'and', 'code', 'link', 'text'],
    )
  })

  it('returns an empty list for blank text', () => {
    expect(tokenize('  \n ')).toEqual([])
  })
})

describe('focalIndex', () => {
  it('picks a letter near the left-centre of the word', () => {
    expect(focalIndex('a')).toBe(0)
    expect(focalIndex('to')).toBe(0)
    expect(focalIndex('read')).toBe(1)
    expect(focalIndex('reading')).toBe(2)
    expect(focalIndex('extraordinary')).toBe(3)
  })

  it('ignores leading punctuation', () => {
    expect(focalIndex('"read')).toBe(2)
  })
})
