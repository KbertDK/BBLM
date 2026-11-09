// Confirm this is still a current Gemini flash model at https://ai.google.dev/gemini-api/docs/models
// (kept in sync with, but intentionally separate from, lib/recap.ts's own constant)
const GEMINI_MODEL = 'gemini-3.8-flash'

export async function generateGeminiText(systemInstruction: string, prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (!res.ok) {
      console.error('Gemini request failed:', res.status, await res.text())
      return null
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return typeof text === 'string' && text.trim() ? text.trim() : null
  } catch (err) {
    console.error('Gemini request errored:', err)
    return null
  }
}
