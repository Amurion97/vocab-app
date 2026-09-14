export type GrammarMatch = {
  message: string
}

type LanguageToolResponse = {
  matches?: Array<{
    message?: string
    shortMessage?: string
  }>
}

export async function checkGrammar(text: string): Promise<GrammarMatch[]> {
  const response = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      text,
      language: "en-US",
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("LanguageTool is unavailable.")
  }

  const data = (await response.json()) as LanguageToolResponse
  const seen = new Set<string>()
  const matches: GrammarMatch[] = []

  for (const match of data.matches ?? []) {
    const message = match.message?.trim() || match.shortMessage?.trim()
    if (!message || seen.has(message)) {
      continue
    }
    seen.add(message)
    matches.push({ message })
  }

  return matches
}
