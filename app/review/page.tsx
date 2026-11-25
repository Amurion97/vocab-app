import { Suspense } from "react"
import Link from "next/link"

import { QuizCard, QuizCardSkeleton } from "@/components/quiz-card"
import { ReviewCongrats } from "@/components/review-congrats"
import { buttonVariants } from "@/components/ui/button"
import { practisedToday } from "@/lib/services/nudge"
import { getNextReviewWord } from "@/lib/dal/words"

async function ReviewContent({
  after,
  requestedId,
}: {
  after?: string
  requestedId?: string
}) {
  const word = await getNextReviewWord(after, requestedId)

  if (!word) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Add some words first, then come back to review.
        </p>
        <Link href="/" className={buttonVariants()}>
          Add a word
        </Link>
      </div>
    )
  }

  if (
    requestedId &&
    practisedToday({
      lastReviewedAt: word.lastReviewedAt,
      now: new Date(),
    })
  ) {
    return <ReviewCongrats key={word.id} word={word} />
  }

  return <QuizCard key={word.id} word={word} />
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; word?: string }>
}) {
  const { after, word: requestedId } = await searchParams

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Review</h1>
        <p className="text-sm text-muted-foreground">
          Write a sentence that uses the word with the right meaning. Grammar
          issues are reported as warnings.
        </p>
      </div>
      <Suspense
        key={`${after ?? ""}-${requestedId ?? ""}`}
        fallback={<QuizCardSkeleton />}
      >
        <ReviewContent after={after} requestedId={requestedId} />
      </Suspense>
    </div>
  )
}
