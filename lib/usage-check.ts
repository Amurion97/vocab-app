import { z } from "zod"

import {
  isUsageCheckBusyError,
  type UsageCheck,
} from "@/lib/clients/gemini-usage"
import {
  GRAMMAR_CHECKERS,
  parseCheckerSelection,
  type ActiveGrammarChecker,
  type GrammarCheckSection,
  type ReviewIssue,
} from "@/lib/issues"

export type IssueUpdate =
  { kind: "clear" } | { kind: "set"; issues: ReviewIssue[] }

export type UsageCheckDeps = {
  checkMeaning: (params: {
    english: string
    vietnamese: string
    sentence: string
  }) => Promise<UsageCheck>
  checkLanguageTool: (sentence: string) => Promise<{ message: string }[]>
  checkGroq: (sentence: string) => Promise<{ message: string }[]>
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
  issues: ReviewIssue[]
): IssueUpdate {
  const passedWithoutIssues = passed && issues.length === 0
  if (passedWithoutIssues) return { kind: "clear" }
  return { kind: "set", issues }
}

export const usageCheckRequestSchema = z
  .object(
    {
      sentence: z
        .string({
          required_error: "Missing word or sentence.",
          invalid_type_error: "Missing word or sentence.",
        })
        .refine((val) => val.trim().length > 0, {
          message: "Write a sentence using the word.",
        })
        .transform((val) => val.trim()),
      checkers: z.preprocess(
        (val) => parseCheckerSelection(val),
        z
          .array(z.enum(GRAMMAR_CHECKERS), {
            invalid_type_error: "Choose LanguageTool, Groq, or both.",
            required_error: "Choose LanguageTool, Groq, or both.",
          })
          .nonempty({
            message: "Choose LanguageTool, Groq, or both.",
          })
      ),
      wordId: z.string().min(1).optional(),
      english: z.string().optional(),
      vietnamese: z.string().optional(),
    },
    {
      required_error: "Missing word or sentence.",
      invalid_type_error: "Missing word or sentence.",
    }
  )
  .superRefine((data, ctx) => {
    if (!data.wordId) {
      const eng = typeof data.english === "string" ? data.english.trim() : ""
      const vie =
        typeof data.vietnamese === "string" ? data.vietnamese.trim() : ""
      if (!eng || !vie) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "English, Vietnamese, and a sentence are required.",
        })
      }
    }
  })

export async function handleUsageCheck(request: Request, deps: UsageCheckDeps) {
  const body = await request.json()

  const parsed = usageCheckRequestSchema.safeParse(body)
  if (!parsed.success) {
    return json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Missing word or sentence.",
      },
      400
    )
  }

  const { sentence, checkers, wordId } = parsed.data
  let english: string
  let vietnamese: string
  let persistWordId: string | undefined

  if (wordId) {
    const word = await deps.findWord(wordId)
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
    english = parsed.data.english!.trim()
    vietnamese = parsed.data.vietnamese!.trim()
  }

  const graded = await gradeUsage(
    deps,
    { english, vietnamese, sentence },
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
      sentence,
      passed: graded.grade.passed,
      issueUpdate: decideIssueUpdate(graded.grade.passed, graded.grade.issues),
    })
    deps.revalidateHome()
  }

  return json({ ok: true, ...graded.grade }, 200)
}

async function gradeUsage(
  deps: UsageCheckDeps,
  params: { english: string; vietnamese: string; sentence: string },
  checkers: ActiveGrammarChecker[]
): Promise<
  | { ok: true; grade: GradeOk }
  | { ok: false; error: string; reason?: "busy"; status: number }
> {
  const callChecker: Record<
    ActiveGrammarChecker,
    (sentence: string) => Promise<{ message: string }[]>
  > = {
    LanguageTool: deps.checkLanguageTool,
    Groq: deps.checkGroq,
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
  const grammarChecks: GrammarCheckSection[] = checkers.map(
    (checker, index) => {
      const result = checkerResults[index]
      if (!result || result.status === "rejected") {
        return { checker, available: false, suggestions: [] }
      }
      return {
        checker,
        available: true,
        suggestions: result.value,
      }
    }
  )
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
    for (const suggestion of check.suggestions) {
      issues.push({
        source: "grammar",
        severity: "warning",
        message: suggestion.message,
        checker: check.checker,
        ...(suggestion.highlight ? { highlight: suggestion.highlight } : {}),
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
