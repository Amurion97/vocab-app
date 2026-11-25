import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import {
  checkWordUsage,
  logUsageCheckFailure,
} from "@/lib/clients/gemini-usage"
import { checkGrammar } from "@/lib/clients/languagetool"
import { checkGroq } from "@/lib/clients/groq-grammar"
import { prisma } from "@/lib/dal/prisma"
import {
  handleUsageCheck,
  type IssueUpdate,
  type UsageCheckDeps,
} from "@/lib/services/usage-check"
import { exhaustiveCheck } from "@/lib/utils/exhaustive-check"

function issueUpdateToPrismaData(issueUpdate: IssueUpdate) {
  if (issueUpdate.kind === "clear") return { issues: [] }
  if (issueUpdate.kind === "set") return { issues: issueUpdate.issues }
  return exhaustiveCheck(issueUpdate as never, "issueUpdate.kind is not listed")
}

const deps: UsageCheckDeps = {
  checkMeaning: checkWordUsage,
  checkLanguageTool: checkGrammar,
  checkGroq,
  findWord: (id) =>
    prisma.word.findUnique({
      where: { id },
      select: { id: true, english: true, vietnamese: true },
    }),
  saveAttempt: async ({ wordId, sentence, passed, issueUpdate }) => {
    const issuesData = issueUpdateToPrismaData(issueUpdate)
    await prisma.word.update({
      where: { id: wordId },
      data: {
        timesReviewed: { increment: 1 },
        timesCorrect: passed ? { increment: 1 } : undefined,
        timesWrong: passed ? undefined : { increment: 1 },
        lastSentence: sentence,
        lastPassed: passed,
        lastReviewedAt: new Date(),
        ...issuesData,
      },
    })
  },
  revalidateHome: () => {
    // Refresh the home page counters/lists. Do NOT revalidate /review,
    // because that would re-render the review page and switch words while
    // the user is still reading the result.
    revalidatePath("/")
  },
}

export async function POST(request: NextRequest) {
  try {
    return await handleUsageCheck(request, deps)
  } catch (error) {
    logUsageCheckFailure(error)
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
