import { Groq } from "groq-sdk"

import {
  isRangeWithin,
  type GrammarQuote,
  type GrammarSuggestion,
} from "@/lib/issues"
import type { GrammarMatch } from "@/lib/languagetool"

export type GroqEdit = {
  original?: string
  replacement?: string
  description?: string
  context?: string
  start?: number
}

export type GroqGrammarResponse = {
  edits?: GroqEdit[]
}

function groqApiKey() {
  const raw = process.env.GROQ_API_KEY?.trim()
  if (!raw) {
    return undefined
  }
  const wrapped =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  const unquoted = wrapped ? raw.slice(1, -1) : raw
  return unquoted.trim() || undefined
}

function findWordOffset(
  context: string,
  word: string,
  startHint?: number,
  usedOffsets?: Set<number>,
  fullText?: string
): number {
  if (!word || !context) return -1

  // 1. If startHint is explicitly provided and matches word within context
  if (
    typeof startHint === "number" &&
    startHint >= 0 &&
    context.startsWith(word, startHint) &&
    (!usedOffsets || !usedOffsets.has(startHint))
  ) {
    return startHint
  }

  // 2. If startHint is sentence-relative and context is a substring of fullText
  if (
    typeof startHint === "number" &&
    startHint >= 0 &&
    fullText &&
    context !== fullText
  ) {
    const contextStart = fullText.indexOf(context)
    if (contextStart !== -1) {
      const relativeStart = startHint - contextStart
      if (
        relativeStart >= 0 &&
        context.startsWith(word, relativeStart) &&
        (!usedOffsets || !usedOffsets.has(relativeStart))
      ) {
        return relativeStart
      }
    }
  }

  // 3. Search for the next available occurrence that hasn't been used yet
  let searchFrom = 0
  while (searchFrom <= context.length - word.length) {
    const at = context.indexOf(word, searchFrom)
    if (at === -1) break
    if (!usedOffsets || !usedOffsets.has(at)) {
      return at
    }
    searchFrom = at + 1
  }

  // Fallback to first occurrence
  return context.indexOf(word)
}

function contextOf(
  text: string,
  word: string,
  base: string,
  contextSentence?: string,
  start?: number,
  usedOffsets?: Set<number>
): GrammarQuote {
  const rawSentence = contextSentence?.trim()
  const rawContext = rawSentence ? rawSentence : text
  const context = rawContext.trim()
  const quote: GrammarQuote = { base, word, context }
  if (!word) {
    return quote
  }

  const offset = findWordOffset(context, word, start, usedOffsets, text)
  if (offset !== -1 && isRangeWithin(context, offset, word.length)) {
    quote.highlight = { offset, length: word.length }
    usedOffsets?.add(offset)
  }
  return quote
}

export type CheckGroqDeps = {
  apiKey?: string
  client?: Pick<Groq, "chat">
}

export async function checkGroq(
  text: string,
  deps?: CheckGroqDeps
): Promise<GrammarMatch[]> {
  const key = deps?.apiKey ?? groqApiKey()
  if (!key) {
    throw new Error("Groq is unavailable.")
  }

  const trimmedText = text.trim()
  if (!trimmedText) {
    return []
  }

  const client = deps?.client ?? new Groq({ apiKey: key })

  let content = ""
  try {
    const completion = await client.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: `You are an expert English grammar checker.
Analyze the user's sentence for grammatical errors, spelling mistakes, agreement errors, incorrect prepositions, and unnatural phrasing.
Respond ONLY with a JSON object in this format:
{
  "edits": [
    {
      "original": "the exact erroneous word or phrase as it appears in the sentence",
      "replacement": "suggested correction",
      "description": "short explanation (e.g. Subject-verb agreement, Spelling, Wrong preposition)",
      "context": "the specific clause or surrounding phrase containing the error (especially if the word appears multiple times)",
      "start": 0
    }
  ]
}
If the sentence has no grammatical, spelling, or phrasing errors, return {"edits": []}.`,
        },
        {
          role: "user",
          content: trimmedText,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    })

    content = completion.choices[0]?.message?.content ?? ""
  } catch (error) {
    throw new Error("Groq is unavailable.", { cause: error })
  }

  let data: GroqGrammarResponse | null = null
  try {
    data = JSON.parse(content) as GroqGrammarResponse
  } catch {
    return []
  }

  const rawEdits = Array.isArray(data?.edits) ? data.edits : []

  const matches: GrammarMatch[] = []
  const usedOffsetsByContext = new Map<string, Set<number>>()

  for (const edit of rawEdits) {
    if (!edit || typeof edit !== "object") {
      continue
    }

    const replacement = edit.replacement?.trim() ?? ""
    const original = edit.original?.trim() ?? ""
    if (!original && !replacement) {
      continue
    }

    const change =
      original && replacement
        ? `${original} → ${replacement}`
        : replacement || original
    const description = edit.description?.trim()
    const message = description ? `${description} ${change}` : change
    const suggestion: GrammarSuggestion = { message }

    if (original) {
      const rawSentence = edit.context?.trim()
      const rawContext = rawSentence ? rawSentence : trimmedText
      const contextKey = `${rawContext.trim()}:${original}`
      let usedOffsets = usedOffsetsByContext.get(contextKey)
      if (!usedOffsets) {
        usedOffsets = new Set<number>()
        usedOffsetsByContext.set(contextKey, usedOffsets)
      }

      suggestion.quote = contextOf(
        trimmedText,
        original,
        description || "Suggested edit:",
        edit.context,
        edit.start,
        usedOffsets
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
