import {
  isRangeWithin,
  type GrammarHighlight,
  type GrammarQuote,
  type GrammarSuggestion,
} from "@/lib/issues"
import type { GrammarMatch } from "@/lib/languagetool"

type SaplingEdit = {
  start?: number
  end?: number
  replacement?: string
  description?: string
  sentence?: string
  sentence_start?: number
  error_type?: string
  general_error_type?: string
}

type SaplingResponse = {
  edits?: SaplingEdit[]
}

function saplingApiKey() {
  // Next can leave one unmatched quote on the env value. Sapling keys have none.
  const raw = process.env.SAPLING_API_KEY?.trim()
  if (!raw) {
    return undefined
  }
  const wrapped =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  const unquoted = wrapped ? raw.slice(1, -1) : raw.replace(/^["']/, "")
  return unquoted.trim() || undefined
}

function contextOf(
  text: string,
  edit: SaplingEdit,
  word: string,
  base: string
) {
  const rawSentence = edit.sentence
  const rawContext = rawSentence?.trim() ? rawSentence : text
  const context = rawContext.trim()
  const quote: GrammarQuote = { base, word, context }
  if (typeof edit.start !== "number" || typeof edit.end !== "number" || !word) {
    return quote
  }
  const raw = text.slice(edit.start, edit.end)
  const leading = raw.length - raw.trimStart().length
  const contextLeading = rawContext.length - rawContext.trimStart().length
  const offset =
    edit.start + leading - (edit.sentence_start ?? 0) - contextLeading
  const highlight: GrammarHighlight = { offset, length: word.length }
  if (
    isRangeWithin(context, offset, word.length) &&
    context.startsWith(word, offset)
  ) {
    quote.highlight = highlight
  }
  return quote
}

export async function checkSapling(text: string): Promise<GrammarMatch[]> {
  const key = saplingApiKey()
  if (!key) {
    throw new Error("Sapling is unavailable.")
  }

  const response = await fetch("https://api.sapling.ai/api/v1/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      text,
      session_id: crypto.randomUUID(),
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Sapling is unavailable.")
  }

  const data = (await response.json()) as SaplingResponse
  const matches: GrammarMatch[] = []
  const edits = Array.isArray(data?.edits) ? data.edits : []

  for (const edit of edits) {
    if (!edit || typeof edit !== "object") {
      continue
    }
    const replacement = edit.replacement?.trim() ?? ""
    const original =
      typeof edit.start === "number" && typeof edit.end === "number"
        ? text.slice(edit.start, edit.end).trim()
        : ""
    if (!original && !replacement) {
      continue
    }
    const change = original ? `${original} → ${replacement}` : replacement
    const description = edit.description?.trim()
    const message = description ? `${description} ${change}` : change
    const suggestion: GrammarSuggestion = { message }
    if (original) {
      suggestion.quote = contextOf(
        text,
        edit,
        original,
        description || "Suggested edit:"
      )
      const quote = suggestion.quote
      if (quote.highlight) {
        const at = description ? description.length + 1 : 0
        if (message.startsWith(original, at)) {
          suggestion.highlight = { offset: at, length: original.length }
        }
      }
    }
    if (replacement) {
      suggestion.replacements = [replacement]
    }
    matches.push(suggestion)
  }

  return matches
}
