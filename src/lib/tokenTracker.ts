const TOKEN_TRACKER = 'https://token-tracker-roan.vercel.app/api/tokens'

export const DAILY_LIMIT = 250_000

export async function getTokensUsed(): Promise<number | null> {
  try {
    const res = await fetch(TOKEN_TRACKER)
    if (!res.ok) return null
    const { tokens } = (await res.json()) as { tokens: number }
    return tokens
  } catch {
    return null // fail open
  }
}

export async function reportTokens(count: number): Promise<void> {
  try {
    await fetch(TOKEN_TRACKER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: count }),
    })
  } catch {
    // fire and forget
  }
}
