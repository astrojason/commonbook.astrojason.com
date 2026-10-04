import { describe, it, expect } from 'vitest'
import { breakUpProse } from './prose'

describe('breakUpProse', () => {
  it('leaves short text untouched', () => {
    const t = 'One short sentence. Another one.'
    expect(breakUpProse(t)).toBe(t)
  })

  it('leaves text that already has structure untouched', () => {
    const t = 'A. '.repeat(200) + '\n\n- item\n- item'
    expect(breakUpProse(t)).toBe(t)
    const two = 'First para.\n\nSecond para.'
    expect(breakUpProse(two)).toBe(two)
  })

  it('splits a long single-paragraph wall into paragraphs of up to ~2 sentences', () => {
    const s = 'This is a reasonably long sentence that carries some real content in it.'
    const wall = Array(6).fill(s).join(' ')
    const out = breakUpProse(wall)
    const paras = out.split('\n\n')
    expect(paras).toHaveLength(3)
    expect(paras.every(p => p === `${s} ${s}`)).toBe(true)
  })

  it('does not split on common abbreviations or decimals', () => {
    const wall = 'Dr. Smith measured 3.5 units, e.g. in the lab. '.repeat(8).trim()
    const out = breakUpProse(wall)
    expect(out).not.toMatch(/Dr\.\n\n/)
    expect(out).not.toMatch(/3\.\n\n5/)
    expect(out).not.toMatch(/e\.g\.\n\n/)
  })
})
