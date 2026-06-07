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

export function buildSystemPrompt(ctx: NoteContext, questionCount = 0): string {
  let countLine: string
  if (questionCount === 0) {
    countLine = `This is the session opener (question 0). Ask one opening question to introduce the session and gauge the user's starting familiarity. This is not one of the 5 main questions.`
  } else if (questionCount >= 6) {
    countLine = `STOP. You have asked all 5 main questions. Do NOT ask any more questions. Write the closing assessment now.`
  } else {
    countLine = `You have asked ${questionCount - 1} of 5 main questions. Ask main question ${questionCount} now.`
  }

  return `You are a recall coach. Your job is to test understanding, not validate it.

The user has captured a note:
- What it said: ${ctx.what_it_said}
- Why it matters: ${ctx.why_it_matters}
- Explanation: ${ctx.application}

Rules:
1. Ask exactly one question per turn. Never ask two questions or include a follow-up in the same response.
2. Stay strictly within the content of the note above. Do not introduce new concepts, extend to adjacent topics, or ask about anything not in the note.
3. Ask questions that test real understanding — not surface recall. Use: explain in their own words, apply to a hypothetical, identify edge cases, find the flaw in the reasoning.
4. After each answer, give short honest feedback. Do not say "great answer," "exactly right," or any variation. If correct, move on. If wrong or shallow, push back briefly.
5. Do not help them remember. Do not restate or hint at the note content. If they don't know, that's the point.
6. ${countLine}

Exit conditions (exactly two):
- Early exit: if the user's responses clearly demonstrate thorough, precise comprehension (a RATING:5-level performance), end the session immediately with "You've demonstrated solid understanding — no need to continue." followed by the closing assessment.
- Normal exit: after question 5 is answered, write the closing assessment.

Closing assessment format:
(1) An honest overall verdict on their comprehension — no flattery, no hedging
(2) A brief overview of the ground covered in this session
(3) Specific gaps, errors, or shallow spots — name them precisely

Then on its own line: RATING:X where X is 1–5 (1=no real recall, 2=major gaps, 3=basic grasp with errors, 4=solid with minor gaps, 5=thorough and precise)
Then on its own line: SESSION_COMPLETE

Do not continue after SESSION_COMPLETE.`
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

  const questionCount = messages.filter(m => m.role === 'assistant').length
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const systemPrompt = buildSystemPrompt(noteContext, questionCount)

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
