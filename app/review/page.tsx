import Link from "next/link"

import { QuizCard } from "@/components/quiz-card"
import { ReviewCongrats } from "@/components/review-congrats"
import { buttonVariants } from "@/components/ui/button"
import { practisedToday } from "@/lib/nudge"
import { getNextReviewWord } from "@/lib/words"

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ after?: string; word?: string }>
}) {
  const { after, word: requestedId } = await searchParams
  const word = await getNextReviewWord(after, requestedId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Review</h1>
        <p className="text-sm text-muted-foreground">
          Write a sentence that uses the word with the right meaning. Grammar
          issues are reported as warnings.
        </p>
      </div>
      {word ? (
        requestedId &&
        practisedToday({
          lastReviewedAt: word.lastReviewedAt,
          now: new Date(),
        }) ? (
          <ReviewCongrats key={word.id} word={word} />
        ) : (
          <QuizCard key={word.id} word={word} />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Add some words first, then come back to review.
          </p>
          <Link href="/" className={buttonVariants()}>
            Add a word
          </Link>
        </div>
      )}
    </div>
  )
}
