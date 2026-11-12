import { AddWordForm } from "@/components/add-word-form"
import { getPaginatedWords } from "@/lib/words"
import { Suspense } from "react"
import { InfiniteWordList } from "@/components/infinite-word-list"
import { WordCardSkeleton } from "@/components/word-card"

async function SavedWordList() {
  const { words, nextCursor } = await getPaginatedWords(10)
  if (words.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No words yet. Add one above to start reviewing.
      </p>
    )
  }

  return <InfiniteWordList initialWords={words} initialCursor={nextCursor} />
}

export default async function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Words</h1>
        <p className="text-sm text-muted-foreground">
          Save English words with Vietnamese translations, then review them by
          writing a usage sentence.
        </p>
      </div>
      <AddWordForm />
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">Saved words</h2>
        {/*Since the words are fetched server side, we don't need to check the pending state here*/}

        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <WordCardSkeleton />
              <WordCardSkeleton />
              <WordCardSkeleton />
            </div>
          }
        >
          <SavedWordList />
        </Suspense>
      </section>
    </div>
  )
}
