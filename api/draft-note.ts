import OpenAI from 'openai'

interface DraftNoteRequest {
  title?: string
  content?: string
  summary?: string
}

interface DraftNoteResult {
  tag: string
  what_it_said: string
  why_it_matters: string
  application: string
}

interface Req {
  method: string
  body: unknown
}

interface Res {
  status(code: number): Res
  json(data: unknown): void
}

export function buildDraftPrompt(title: string, body: string): string {
  return `You are drafting a spaced-repetition note from an article for the commonbook app.

Article title: ${title}
Article text:
${body}

Produce a JSON object with exactly these fields:
- "tag": a single short lowercase topic tag (one or two words)
- "what_it_said": a factual, concrete summary of the article's core claim or content (2-4 sentences)
- "why_it_matters": why this idea is significant or useful (1-3 sentences)
- "application": a plain-language explanation or analogy a reader could use to explain this idea to someone else (not an action plan)

Respond with only the JSON object, no other text.`
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { title, content, summary } = (req.body ?? {}) as DraftNoteRequest
  const body = content?.trim() || summary?.trim()
  if (!title || !body) {
    res.status(400).json({ error: 'Missing title or content/summary' })
    return
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const prompt = buildDraftPrompt(title, body)

  let raw: string | null | undefined
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    })
    raw = completion.choices[0]?.message?.content
  } catch {
    res.status(502).json({ error: 'OpenAI request failed' })
    return
  }

  if (!raw) {
    res.status(502).json({ error: 'OpenAI returned no content' })
    return
  }

  let parsed: Partial<DraftNoteResult>
  try {
    parsed = JSON.parse(raw)
  } catch {
    res.status(502).json({ error: 'OpenAI returned malformed JSON' })
    return
  }

  if (!parsed.what_it_said || !parsed.why_it_matters || !parsed.application) {
    res.status(502).json({ error: 'OpenAI response missing required fields' })
    return
  }

  res.status(200).json({
    tag: parsed.tag ?? '',
    what_it_said: parsed.what_it_said,
    why_it_matters: parsed.why_it_matters,
    application: parsed.application,
  })
}
