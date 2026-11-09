import { generateGeminiText } from '@/lib/gemini'

const TEAM_NAME_SYSTEM_INSTRUCTION = `You name teams for Blood Bowl, the fantasy football tabletop game.
Given a race, invent exactly one short, evocative, flavorful team name fitting that race's culture
and playstyle. Output ONLY the name itself — no quotes, no punctuation around it, no explanation,
no alternatives.`

export async function generateTeamName(raceName: string): Promise<string | null> {
  const prompt = `Race: ${raceName}`
  const result = await generateGeminiText(TEAM_NAME_SYSTEM_INSTRUCTION, prompt)
  if (!result) return null
  // Strip stray wrapping quotes some models add despite instructions.
  return result.replace(/^["'“”]+|["'“”]+$/g, '').trim() || null
}

const PLAYER_NAMES_SYSTEM_INSTRUCTION = `You name players for Blood Bowl, the fantasy football tabletop game.
Given a team's name, its race, and an ordered list of player positions needing names, invent one
fitting, flavorful name per player — matching the race's culture and the position's role. Output
EXACTLY one name per line, in the exact same order as the given positions, with no numbering, no
bullet points, no blank lines, and no extra commentary before or after the list.`

export async function generatePlayerNames(input: {
  teamName:  string
  raceName:  string
  positions: string[]
}): Promise<string[] | null> {
  if (input.positions.length === 0) return []

  const prompt = [
    `Team name: ${input.teamName}`,
    `Race: ${input.raceName}`,
    '',
    'Players needing names, in order:',
    ...input.positions.map((p, i) => `${i + 1}. ${p}`),
  ].join('\n')

  const result = await generateGeminiText(PLAYER_NAMES_SYSTEM_INSTRUCTION, prompt)
  if (!result) return null

  const names = result
    .split('\n')
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter((line) => line.length > 0)

  return names.length === input.positions.length ? names : null
}
