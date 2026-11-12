import type { Word } from "@prisma/client"

import { parseIssues } from "@/lib/issues"
import { prisma } from "@/lib/prisma"

export async function getWords() {
  return prisma.word.findMany({
    orderBy: { createdAt: "desc" },
  })
}

export async function getPaginatedWords(limit = 10, cursor?: string) {
  const words = await prisma.word.findMany({
    take: limit,
    ...(cursor
      ? {
          skip: 1, // skip the cursor word
          cursor: {
            id: cursor,
          },
        }
      : {}),
    orderBy: { createdAt: "desc" },
  })
  // if the number of words returned is less than the limit, there are no more words to fetch
  const nextCursor: string | null =
    words.length === limit ? words[limit - 1].id : null

  // artificially delay response
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return {
    words,
    nextCursor,
  }
}

export async function getWordById(id: string) {
  return prisma.word.findUnique({
    where: { id },
  })
}

export async function getNextReviewWord(
  excludeId?: string,
  requestedId?: string
) {
  const words = await prisma.word.findMany()

  if (requestedId) {
    const requested = words.find((word) => word.id === requestedId)
    if (requested) {
      return requested
    }
  }

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
