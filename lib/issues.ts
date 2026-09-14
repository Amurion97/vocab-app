export type ReviewIssue = {
  source: "meaning" | "grammar"
  severity: "error" | "warning"
  message: string
}

export function parseIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isReviewIssue)
}

function isReviewIssue(value: unknown): value is ReviewIssue {
  if (!value || typeof value !== "object") {
    return false
  }

  const issue = value as Partial<ReviewIssue>
  return (
    (issue.source === "meaning" || issue.source === "grammar") &&
    (issue.severity === "error" || issue.severity === "warning") &&
    typeof issue.message === "string"
  )
}
