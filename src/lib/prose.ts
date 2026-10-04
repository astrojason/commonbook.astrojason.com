const MIN_LENGTH = 280
const SENTENCES_PER_PARAGRAPH = 2
const ABBREVIATIONS = /(?:Dr|Mr|Mrs|Ms|Prof|St|vs|etc|e\.g|i\.e)\.$/i

/**
 * Notes captured as one long block of text are hard to scan. When a body is a
 * single unstructured paragraph, split it into short paragraphs at sentence
 * boundaries. Anything already structured (blank lines, lists, headings) is
 * returned unchanged.
 */
export function breakUpProse(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length < MIN_LENGTH) return text
  if (/\n\s*\n/.test(trimmed) || /^\s*([-*+]|\d+\.|#{1,6})\s/m.test(trimmed)) return text

  const pieces = trimmed.split(/(?<=[.!?])\s+(?=[A-Z"'(])/)
  const sentences: string[] = []
  for (const piece of pieces) {
    const prev = sentences[sentences.length - 1]
    if (prev !== undefined && ABBREVIATIONS.test(prev)) sentences[sentences.length - 1] = `${prev} ${piece}`
    else sentences.push(piece)
  }
  if (sentences.length <= SENTENCES_PER_PARAGRAPH) return text

  const paragraphs: string[] = []
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(sentences.slice(i, i + SENTENCES_PER_PARAGRAPH).join(' '))
  }
  return paragraphs.join('\n\n')
}
