import {
  isUsageCheckBusyError,
  type UsageCheck,
} from "@/lib/gemini-usage"
import {
  parseCheckerSelection,
  type GrammarCheckSection,
  type GrammarChecker,
  type ReviewIssue,
} from "@/lib/issues"

export type IssueUpdate =
  | { kind: "preserve" }
  | { kind: "clear" }
  | { kind: "set"; issues: ReviewIssue[] }

export type UsageCheckDeps = {
  checkMeaning: (params: {
    english: string
    vietnamese: string
    sentence: string
  }) => Promise<UsageCheck>
  checkLanguageTool: (sentence: string) => Promise<{ message: string }[]>
  checkSapling: (sentence: string) => Promise<{ message: string }[]>
  findWord: (id: string) => Promise<{
    id: string
    english: string
    vietnamese: string
  } | null>
  saveAttempt: (input: {
    wordId: string
    sentence: string
    passed: boolean
    issueUpdate: IssueUpdate
  }) => Promise<void>
  revalidateHome: () => void
}

type GradeOk = {
  passed: boolean
  wordPresent: boolean
  feedback: string
  suggestion: string | null
  issues: ReviewIssue[]
  grammarChecks: GrammarCheckSection[]
}

function json(body: unknown, status: number) {
  return Response.json(body, { status })
}

function decideIssueUpdate(
  passed: boolean,
  issues: ReviewIssue[],
  grammarChecks: GrammarCheckSection[]
): IssueUpdate {
  const passedWithoutIssues = passed && issues.length === 0
  const checkerDown = grammarChecks.some((check) => !check.available)
  if (passedWithoutIssues && checkerDown) return { kind: "preserve" }
  if (passedWithoutIssues) return { kind: "clear" }
  return { kind: "set", issues }
}

export async function handleUsageCheck(request: Request, deps: UsageCheckDeps) {
  const body = (await request.json()) as {
    wordId?: string
    english?: string
    vietnamese?: string
    sentence?: string
    checkers?: unknown
  }

  if (typeof body.sentence !== "string") {
    return json({ ok: false, error: "Missing word or sentence." }, 400)
  }

  const trimmed = body.sentence.trim()
  if (!trimmed) {
    return json({ ok: false, error: "Write a sentence using the word." }, 400)
  }

  const checkers = parseCheckerSelection(body.checkers)
  if (!checkers) {
    return json(
      { ok: false, error: "Choose LanguageTool, Sapling, or both." },
      400
    )
  }

  let english: string
  let vietnamese: string
  let persistWordId: string | undefined

  if (body.wordId) {
    const word = await deps.findWord(body.wordId)
    if (!word) {
      return json(
        { ok: false, error: "That word is no longer in your list." },
        404
      )
    }
    english = word.english
    vietnamese = word.vietnamese
    persistWordId = word.id
  } else {
    const nextEnglish =
      typeof body.english === "string" ? body.english.trim() : ""
    const nextVietnamese =
      typeof body.vietnamese === "string" ? body.vietnamese.trim() : ""
    if (!nextEnglish || !nextVietnamese) {
      return json(
        {
          ok: false,
          error: "English, Vietnamese, and a sentence are required.",
        },
        400
      )
    }
    english = nextEnglish
    vietnamese = nextVietnamese
  }

  const graded = await gradeUsage(
    deps,
    { english, vietnamese, sentence: trimmed },
    checkers
  )
  if (!graded.ok) {
    return json(
      { ok: false, error: graded.error, reason: graded.reason },
      graded.status
    )
  }

  if (request.signal.aborted) {
    return json({ ok: false, error: "Cancelled." }, 499)
  }

  if (persistWordId) {
    await deps.saveAttempt({
      wordId: persistWordId,
      sentence: trimmed,
      passed: graded.grade.passed,
      issueUpdate: decideIssueUpdate(
        graded.grade.passed,
        graded.grade.issues,
        graded.grade.grammarChecks
      ),
    })
    deps.revalidateHome()
  }

  return json({ ok: true, ...graded.grade }, 200)
}

async function gradeUsage(
  deps: UsageCheckDeps,
  params: { english: string; vietnamese: string; sentence: string },
  checkers: GrammarChecker[]
): Promise<
  | { ok: true; grade: GradeOk }
  | { ok: false; error: string; reason?: "busy"; status: number }
> {
  const callChecker = {
    LanguageTool: deps.checkLanguageTool,
    Sapling: deps.checkSapling,
  }
  const meaningPromise = deps.checkMeaning(params)
  const checkerPromise = Promise.allSettled(
    checkers.map((checker) => callChecker[checker](params.sentence))
  )
  const [usageResult, checkerResults] = await Promise.all([
    meaningPromise.then(
      (value) => ({ status: "fulfilled" as const, value }),
      (reason: unknown) => ({ status: "rejected" as const, reason })
    ),
    checkerPromise,
  ])

  if (usageResult.status === "rejected") {
    const error = usageResult.reason
    if (isUsageCheckBusyError(error)) {
      return {
        ok: false,
        error: error.message,
        reason: "busy",
        status: 503,
      }
    }
    return {
      ok: false,
      error:
        error instanceof Error && error.message === "set GEMINI_API_KEY"
          ? "set GEMINI_API_KEY"
          : error instanceof Error
            ? error.message
            : "Could not check word usage.",
      status: 500,
    }
  }

  const usage = usageResult.value
  const grammarChecks: GrammarCheckSection[] = checkers.map((checker, index) => {
    const result = checkerResults[index]
    if (!result || result.status === "rejected") {
      return { checker, available: false, suggestions: [] }
    }
    return {
      checker,
      available: true,
      suggestions: result.value.map((match) => match.message),
    }
  })
  const passed = usage.usedCorrectly
  const issues: ReviewIssue[] = []

  if (!passed) {
    issues.push({
      source: "meaning",
      severity: "error",
      message: usage.feedback,
    })
  }

  for (const check of grammarChecks) {
    if (!check.available) {
      continue
    }
    for (const message of check.suggestions) {
      issues.push({
        source: "grammar",
        severity: "warning",
        message,
        checker: check.checker,
      })
    }
  }

  return {
    ok: true,
    grade: {
      passed,
      wordPresent: usage.wordPresent,
      feedback: usage.feedback,
      suggestion: usage.suggestion,
      issues,
      grammarChecks,
    },
  }
}
