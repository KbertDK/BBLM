// Confirm this is still a current Gemini flash model at https://ai.google.dev/gemini-api/docs/models
const GEMINI_MODEL = 'gemini-2.0-flash'

const SYSTEM_INSTRUCTION = `You are a seasoned Blood Bowl pundit crossed with a breathless sky-sports
football journalist — cynical wit, hard-hitting, treats every match like real sporting drama.
Reference Nuffle's fickle favor or wrath on key swings, question the ref's calls on close
casualties or fouls, dramatize big blocks and touchdowns, and speculate on whether standout
players are heading for the MVP trophy or a trip to the apothecary. Write 2-4 short paragraphs
of plain prose — no markdown, no headings, no bullet points. Only use the events given to you;
never invent plays, players, or stats that aren't in the supplied match events.`

export async function generateMatchRecap(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  eventLabels: string[],
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt = [
    `Final score: ${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}.`,
    '',
    'Match events, in order:',
    ...eventLabels.map((label) => `- ${label}`),
  ].join('\n')

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (!res.ok) {
      console.error('Gemini recap request failed:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (err) {
    console.error('Gemini recap request errored:', err)
    return null
  }
}
