import { z } from "zod"

export const GRAMMAR_CHECKERS = ["LanguageTool", "Groq"] as const

export type ActiveGrammarChecker = (typeof GRAMMAR_CHECKERS)[number]

// "Sapling" is kept in the GrammarChecker union for backwards compatibility with historical reviews in Word.issues.
export type GrammarChecker = ActiveGrammarChecker | "Sapling"

// offset and length index the reminder message, not the learner's sentence.
export type GrammarHighlight = {
  offset: number
  length: number
}

// The parts message was assembled from, so the UI can lay them out as
// separate lines instead of re-splitting the joined string.
export type GrammarQuote = {
  base: string
  word: string
  context?: string
  highlight?: GrammarHighlight
}

export type GrammarSuggestion = {
  message: string
  highlight?: GrammarHighlight
  quote?: GrammarQuote
  replacements?: string[]
}

export type ReviewIssue = {
  source: "meaning" | "grammar"
  severity: "error" | "warning"
  message: string
  checker?: GrammarChecker
  highlight?: GrammarHighlight
}

export function isRangeWithin(
  text: string,
  offset: unknown,
  length: unknown
): boolean {
  if (typeof offset !== "number" || typeof length !== "number") {
    return false
  }
  if (!Number.isInteger(offset) || !Number.isInteger(length)) {
    return false
  }
  return offset >= 0 && length > 0 && offset <= text.length - length
}

export const checkerSelectionSchema = z
  .array(z.enum(GRAMMAR_CHECKERS))
  .nonempty()
  .transform((items) => {
    const selected: ActiveGrammarChecker[] = []
    for (const item of items) {
      if (!selected.includes(item)) {
        selected.push(item)
      }
    }
    return selected
  })

export function parseCheckerSelection(
  value: unknown
): ActiveGrammarChecker[] | null {
  const result = checkerSelectionSchema.safeParse(value)
  return result.success ? result.data : null
}

export type GrammarCheckSection = {
  checker: GrammarChecker
  available: boolean
  suggestions: GrammarSuggestion[]
}

export const grammarHighlightSchema = z.object({
  offset: z.number().int().nonnegative(),
  length: z.number().int().positive(),
})

const baseIssueSchema = z.object({
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  highlight: grammarHighlightSchema.optional(),
})

const meaningIssueSchema = baseIssueSchema.extend({
  source: z.literal("meaning"),
})

const grammarIssueSchema = baseIssueSchema.extend({
  source: z.literal("grammar"),
  checker: z.enum(["LanguageTool", "Groq", "Sapling"]).optional(),
})

export const reviewIssueSchema = z
  .discriminatedUnion("source", [meaningIssueSchema, grammarIssueSchema])
  .refine(
    (issue) =>
      !issue.highlight ||
      isRangeWithin(
        issue.message,
        issue.highlight.offset,
        issue.highlight.length
      ),
    {
      message: "Highlight range must be within message",
      path: ["highlight"],
    }
  )

export function parseIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    const result = reviewIssueSchema.safeParse(item)
    return result.success ? [result.data] : []
  })
}

export function reminderLabel(issue: ReviewIssue): string {
  if (issue.source === "meaning") {
    return `Meaning: ${issue.message}`
  }
  if (issue.checker) {
    return `${issue.checker}: ${issue.message}`
  }
  return `Grammar: ${issue.message}`
}
