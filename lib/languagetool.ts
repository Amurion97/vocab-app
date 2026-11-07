import {
  isRangeWithin,
  type GrammarHighlight,
  type GrammarQuote,
  type GrammarSuggestion,
} from "@/lib/issues"

export type GrammarMatch = GrammarSuggestion

type LanguageToolContext = {
  text?: string
  offset?: number
  length?: number
}

type LanguageToolMatch = {
  message?: string
  shortMessage?: string
  offset?: number
  length?: number
  context?: LanguageToolContext
  replacements?: unknown
}

type LanguageToolResponse = {
  matches?: LanguageToolMatch[]
}

function span(text: string, offset: unknown, length: unknown): string {
  if (!isRangeWithin(text, offset, length)) {
    return ""
  }
  return text
    .slice(offset as number, (offset as number) + (length as number))
    .trim()
}

// The quoted word sits at context.offset when that offset survives trimming,
// and context always contains the word by the time this runs.
function wordOffsetIn(context: string, word: string, hint: unknown): number {
  if (typeof hint === "number" && context.startsWith(word, hint)) {
    return hint
  }
  return context.indexOf(word)
}

function replacementValues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  const values: string[] = []
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue
    }
    const candidate = (item as { value?: unknown }).value
    if (typeof candidate !== "string") {
      continue
    }
    const replacement = candidate.trim()
    if (replacement && !values.includes(replacement)) {
      values.push(replacement)
    }
  }
  return values
}

type Location = {
  text: string
  highlight?: GrammarHighlight
  quote?: Omit<GrammarQuote, "base">
}

// offset/length index the sentence that was posted. context is a shorter
// window, with its own offset/length, used when the sentence span is missing.
function locationLabel(sentence: string, match: LanguageToolMatch): Location {
  const excerpt = span(sentence, match.offset, match.length)
  const contextText = match.context?.text?.trim() ?? ""
  const contextExcerpt = span(
    contextText,
    match.context?.offset,
    match.context?.length
  )
  const word = excerpt || contextExcerpt
  if (!word) {
    return { text: "" }
  }
  if (contextText && contextText !== word && contextText.includes(word)) {
    // `"word" in "` is word.length + 7 characters wide.
    const at = wordOffsetIn(contextText, word, match.context?.offset)
    return {
      text: `"${word}" in "${contextText}"`,
      highlight: { offset: word.length + 7 + at, length: word.length },
      quote: {
        word,
        context: contextText,
        highlight: { offset: at, length: word.length },
      },
    }
  }
  return {
    text: `"${word}"`,
    highlight: { offset: 1, length: word.length },
    quote: { word },
  }
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
    const base = match.message?.trim() || match.shortMessage?.trim()
    if (!base) {
      continue
    }
    const location = locationLabel(text, match)
    const message = location.text ? `${base} ${location.text}` : base
    if (seen.has(message)) {
      continue
    }
    seen.add(message)

    const suggestion: GrammarMatch = { message }
    if (location.highlight) {
      suggestion.highlight = {
        offset: base.length + 1 + location.highlight.offset,
        length: location.highlight.length,
      }
    }
    if (location.quote) {
      suggestion.quote = { base, ...location.quote }
    }
    const replacements = replacementValues(match.replacements)
    if (replacements.length > 0) {
      suggestion.replacements = replacements
    }
    matches.push(suggestion)
  }

  return matches
}
