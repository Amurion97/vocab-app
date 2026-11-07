export const GRAMMAR_CHECKERS = ["LanguageTool", "Sapling"] as const

export type GrammarChecker = (typeof GRAMMAR_CHECKERS)[number]

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

export function parseCheckerSelection(value: unknown): GrammarChecker[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }

  const selected: GrammarChecker[] = []
  for (const item of value) {
    if (item !== "LanguageTool" && item !== "Sapling") {
      return null
    }
    if (!selected.includes(item)) {
      selected.push(item)
    }
  }

  return selected
}

export type GrammarCheckSection = {
  checker: GrammarChecker
  available: boolean
  suggestions: GrammarSuggestion[]
}

export function parseIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((item) => {
    const issue = readIssue(item)
    return issue ? [issue] : []
  })
}

function readIssue(value: unknown): ReviewIssue | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const issue = value as Partial<ReviewIssue>
  if (
    (issue.source !== "meaning" && issue.source !== "grammar") ||
    (issue.severity !== "error" && issue.severity !== "warning") ||
    typeof issue.message !== "string"
  ) {
    return null
  }

  const parsed: ReviewIssue = {
    source: issue.source,
    severity: issue.severity,
    message: issue.message,
  }
  if (
    parsed.source === "grammar" &&
    (issue.checker === "LanguageTool" || issue.checker === "Sapling")
  ) {
    parsed.checker = issue.checker
  }
  const highlight = readHighlight(issue.highlight, parsed.message)
  if (highlight) {
    parsed.highlight = highlight
  }
  return parsed
}

function readHighlight(
  value: unknown,
  message: string
): GrammarHighlight | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const { offset, length } = value as Partial<GrammarHighlight>
  if (!isRangeWithin(message, offset, length)) {
    return null
  }
  return { offset: offset as number, length: length as number }
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
