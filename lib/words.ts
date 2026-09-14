import type { Word } from "@prisma/client"

import { parseIssues } from "@/lib/issues"
import { prisma } from "@/lib/prisma"

export async function getWords() {
  return prisma.word.findMany({
    orderBy: { createdAt: "desc" },
  })
}

export async function getNextReviewWord(excludeId?: string) {
  const words = await prisma.word.findMany()
  const pool = excludeId ? words.filter((word) => word.id !== excludeId) : words

  if (pool.length === 0) {
    return words[0] ?? null
  }

  const neverReviewed = pool.filter((word) => word.timesReviewed === 0)
  if (neverReviewed.length > 0) {
    return pickOldest(neverReviewed)
  }

  const withMeaningErrors = pool.filter((word) =>
    parseIssues(word.issues).some(
      (issue) => issue.source === "meaning" && issue.severity === "error"
    )
  )
  if (withMeaningErrors.length > 0) {
    return pickOldestReviewed(withMeaningErrors)
  }

  return [...pool].sort(byAccuracyThenReviews)[0]
}

function pickOldest(words: Word[]) {
  return [...words].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )[0]
}

function pickOldestReviewed(words: Word[]) {
  return [...words].sort((a, b) => {
    const aTime = a.lastReviewedAt?.getTime() ?? 0
    const bTime = b.lastReviewedAt?.getTime() ?? 0
    return aTime - bTime
  })[0]
}

function byAccuracyThenReviews(a: Word, b: Word) {
  const accuracyA = a.timesReviewed === 0 ? 0 : a.timesCorrect / a.timesReviewed
  const accuracyB = b.timesReviewed === 0 ? 0 : b.timesCorrect / b.timesReviewed
  if (accuracyA !== accuracyB) {
    return accuracyA - accuracyB
  }
  return a.timesReviewed - b.timesReviewed
}
