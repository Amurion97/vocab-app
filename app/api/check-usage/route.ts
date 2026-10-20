import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

import { checkWordUsage, logUsageCheckFailure } from "@/lib/gemini-usage"
import { checkGrammar } from "@/lib/languagetool"
import { prisma } from "@/lib/prisma"
import { checkSapling } from "@/lib/sapling"
import {
  handleUsageCheck,
  type IssueUpdate,
  type UsageCheckDeps,
} from "@/lib/usage-check"

function issueUpdateToPrismaData(issueUpdate: IssueUpdate) {
  if (issueUpdate.kind === "preserve") return {}
  if (issueUpdate.kind === "clear") return { issues: [] }
  return { issues: issueUpdate.issues }
}

const deps: UsageCheckDeps = {
  checkMeaning: checkWordUsage,
  checkLanguageTool: checkGrammar,
  checkSapling,
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
