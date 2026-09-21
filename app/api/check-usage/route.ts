import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { checkWordUsage, isUsageCheckBusyError } from "@/lib/gemini-usage"
import type { ReviewIssue } from "@/lib/issues"
import { checkGrammar } from "@/lib/languagetool"
import { prisma } from "@/lib/prisma"

type GradeOk = {
  passed: boolean
  wordPresent: boolean
  feedback: string
  suggestion: string | null
  issues: ReviewIssue[]
  grammarUnavailable: boolean
}

async function gradeUsage(params: {
  english: string
  vietnamese: string
  sentence: string
}): Promise<
  | { ok: true; grade: GradeOk }
  | { ok: false; error: string; reason?: "busy"; status: number }
> {
  const [usageResult, grammarResult] = await Promise.allSettled([
    checkWordUsage(params),
    checkGrammar(params.sentence),
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
  const grammarUnavailable = grammarResult.status === "rejected"
  const grammarMatches =
    grammarResult.status === "fulfilled" ? grammarResult.value : []

  const passed = usage.usedCorrectly
  const issues: ReviewIssue[] = []

  if (!passed) {
    issues.push({
      source: "meaning",
      severity: "error",
      message: usage.feedback,
    })
  }

  for (const match of grammarMatches) {
    issues.push({
      source: "grammar",
      severity: "warning",
      message: match.message,
    })
  }

  return {
    ok: true,
    grade: {
      passed,
      wordPresent: usage.wordPresent,
      feedback: usage.feedback,
      suggestion: usage.suggestion,
      issues,
      grammarUnavailable,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      wordId?: string
      english?: string
      vietnamese?: string
      sentence?: string
    }
    const { wordId, sentence } = body

    if (typeof sentence !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing word or sentence." },
        { status: 400 }
      )
    }

    const trimmed = sentence.trim()
    if (!trimmed) {
      return NextResponse.json(
        { ok: false, error: "Write a sentence using the word." },
        { status: 400 }
      )
    }

    let english: string
    let vietnamese: string
    let persistWordId: string | undefined

    if (wordId) {
      const word = await prisma.word.findUnique({ where: { id: wordId } })
      if (!word) {
        return NextResponse.json(
          { ok: false, error: "That word is no longer in your list." },
          { status: 404 }
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
        return NextResponse.json(
          { ok: false, error: "English, Vietnamese, and a sentence are required." },
          { status: 400 }
        )
      }
      english = nextEnglish
      vietnamese = nextVietnamese
    }

    const graded = await gradeUsage({
      english,
      vietnamese,
      sentence: trimmed,
    })

    if (!graded.ok) {
      return NextResponse.json(
        { ok: false, error: graded.error, reason: graded.reason },
        { status: graded.status }
      )
    }

    const { grade } = graded

    if (request.signal.aborted) {
      return NextResponse.json(
        { ok: false, error: "Cancelled." },
        { status: 499 }
      )
    }

    if (persistWordId) {
      const storedIssues =
        grade.passed && grade.issues.length === 0 ? [] : grade.issues

      await prisma.word.update({
        where: { id: persistWordId },
        data: {
          timesReviewed: { increment: 1 },
          timesCorrect: grade.passed ? { increment: 1 } : undefined,
          timesWrong: grade.passed ? undefined : { increment: 1 },
          lastSentence: trimmed,
          lastPassed: grade.passed,
          lastReviewedAt: new Date(),
          issues: storedIssues,
        },
      })

      // Refresh the home page counters/lists. Do NOT revalidate /review,
      // because that would re-render the review page and switch words while
      // the user is still reading the result.
      revalidatePath("/")
    }

    return NextResponse.json({
      ok: true,
      ...grade,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Could not check usage.",
      },
      { status: 500 }
    )
  }
}
