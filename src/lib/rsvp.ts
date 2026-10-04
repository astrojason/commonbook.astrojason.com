/** Split markdown-ish text into plain words for RSVP display. */
export function tokenize(text: string): string[] {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

/** Index of the letter to highlight (optimal recognition point). */
export function focalIndex(word: string): number {
  const lead = word.match(/^[^\p{L}\p{N}]*/u)?.[0].length ?? 0
  const core = word.slice(lead).replace(/[^\p{L}\p{N}]+$/u, '').length
  const offset = core <= 2 ? 0 : core <= 5 ? 1 : core <= 9 ? 2 : 3
  return lead + offset
}
