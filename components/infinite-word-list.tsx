"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import type { Word } from "@prisma/client"
import { WordCard, WordCardSkeleton } from "@/components/word-card"
import { fetchMoreWords } from "@/app/actions"

interface InfiniteWordListProps {
  initialWords: Word[]
  initialCursor?: string | null
}

export function InfiniteWordList({
  initialWords,
  initialCursor,
}: InfiniteWordListProps) {
  const [words, setWords] = useState<Word[]>(initialWords)
  const [cursor, setCursor] = useState<string | null>(initialCursor ?? null)
  const [isPending, startTransition] = useTransition()

  // Sentinel element ref to observe scrolling
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    // no sentinel yet (first load) or no cursor (no more words to fetch)
    if (!sentinel || !cursor) return

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]
        if (firstEntry.isIntersecting && !isPending) {
          startTransition(async () => {
            const res = await fetchMoreWords(10, cursor)
            if (res.ok) {
              setWords((prev) => [...prev, ...res.words])
              setCursor(res.nextCursor)
            }
          })
        }
      },
      {
        rootMargin: "200px", // Pre-fetch words 200px before reaching the bottom
      }
    )

    observer.observe(sentinel)

    return () => {
      observer.unobserve(sentinel)
    }
  }, [cursor, isPending])

  return (
    <div className="flex flex-col gap-3">
      {words.map((word) => (
        <WordCard key={word.id} word={word} />
      ))}

      {isPending && <WordCardSkeleton />}

      {/* Sentinel indicator & Loading feedback */}
      {cursor && (
        <div
          ref={sentinelRef}
          className="flex justify-center py-4 text-sm text-muted-foreground"
        >
          {isPending ? null : "Scroll down to load more"}
        </div>
      )}
    </div>
  )
}
