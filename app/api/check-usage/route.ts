import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { checkWordUsage } from "@/lib/gemini-usage"
import type { ReviewIssue } from "@/lib/issues"
import { checkGrammar } from "@/lib/languagetool"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { wordId?: string; sentence?: string }
    const { wordId, sentence } = body

    if (!wordId || typeof sentence !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing wordId or sentence." },
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

    const word = await prisma.word.findUnique({ where: { id: wordId } })
    if (!word) {
      return NextResponse.json(
        { ok: false, error: "That word is no longer in your list." },
        { status: 404 }
      )
    }

    const [usageResult, grammarResult] = await Promise.allSettled([
      checkWordUsage({
        english: word.english,
        vietnamese: word.vietnamese,
        sentence: trimmed,
      }),
      checkGrammar(trimmed),
    ])

    if (usageResult.status === "rejected") {
      const error = usageResult.reason
      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error && error.message === "set GEMINI_API_KEY"
              ? "set GEMINI_API_KEY"
              : error instanceof Error
                ? error.message
                : "Could not check word usage.",
        },
        { status: 500 }
      )
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

    const storedIssues = passed && issues.length === 0 ? [] : issues

    await prisma.word.update({
      where: { id: wordId },
      data: {
        timesReviewed: { increment: 1 },
        timesCorrect: passed ? { increment: 1 } : undefined,
        timesWrong: passed ? undefined : { increment: 1 },
        lastSentence: trimmed,
        lastPassed: passed,
        lastReviewedAt: new Date(),
        issues: storedIssues,
      },
    })

    // Refresh the home page counters/lists. Do NOT revalidate /review,
    // because that would re-render the review page and switch words while
    // the user is still reading the result.
    revalidatePath("/")

    return NextResponse.json({
      ok: true,
      passed,
      wordPresent: usage.wordPresent,
      feedback: usage.feedback,
      suggestion: usage.suggestion,
      issues,
      grammarUnavailable,
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
