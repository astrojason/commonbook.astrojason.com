import OpenAI from 'openai'

interface NoteContext {
  what_it_said: string
  why_it_matters: string
  application: string
}

interface ChatRequest {
  sessionId?: string
  noteContext?: NoteContext
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>
}

interface Req {
  method: string
  body: unknown
}

interface Res {
  status(code: number): Res
  json(data: unknown): void
  writeHead(code: number, headers: Record<string, string>): void
  write(data: string): void
  end(): void
}

export function buildSystemPrompt(ctx: NoteContext): string {
  return `You are a recall coach. Your job is to test understanding, not validate it.

The user has captured a note:
- What it said: ${ctx.what_it_said}
- Why it matters: ${ctx.why_it_matters}
- Explanation: ${ctx.application}

Rules:
1. Ask 3–5 questions that test real understanding — not surface recall. Use: explain in their own words, apply to a hypothetical, identify edge cases, find the flaw in the reasoning, connect to something else.
2. After each answer, give short honest feedback. If the answer is incomplete or vague, say so directly. Do not say "great answer," "exactly right," or any variation. If the answer is correct, move on. If it's wrong or shallow, push back.
3. Do not help them remember. Do not restate or hint at the note content. If they don't know, that's the point.
4. When all questions are done, output the exact string "SESSION_COMPLETE" on its own line, then stop.`
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { noteContext, messages = [] } = (req.body ?? {}) as ChatRequest

  if (!noteContext) {
    res.status(400).json({ error: 'Missing noteContext' })
    return
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const systemPrompt = buildSystemPrompt(noteContext)

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      stream_options: { include_usage: true },
    })

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
    }

    res.write('data: [DONE]\n\n')
  } catch {
    res.write(`data: ${JSON.stringify({ error: 'OpenAI error' })}\n\n`)
  }

  res.end()
}
