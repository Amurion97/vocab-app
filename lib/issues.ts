export const GRAMMAR_CHECKERS = ["LanguageTool", "Sapling"] as const

export type GrammarChecker = (typeof GRAMMAR_CHECKERS)[number]

export type ReviewIssue = {
  source: "meaning" | "grammar"
  severity: "error" | "warning"
  message: string
  checker?: GrammarChecker
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
  suggestions: string[]
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
  return parsed
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
