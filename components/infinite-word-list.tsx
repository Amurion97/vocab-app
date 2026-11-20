"use client"

import "@/components/wdyr"
import { useEffect, useRef } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { WordCard, WordCardSkeleton } from "@/components/word-card"
import {
  wordsInitialData,
  wordsQueryOptions,
  type WordPage,
} from "@/lib/word-queries"

interface InfiniteWordListProps {
  initialPage: WordPage
}

export function InfiniteWordList({ initialPage }: InfiniteWordListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      ...wordsQueryOptions,
      // Page one came from the server render as a prop, not an independent read.
      // Without this shape TanStack Query refetches page one on mount.
      initialData: wordsInitialData(initialPage),
    })

  // Sentinel element ref to observe scrolling
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    // no sentinel yet (first load) or no more pages to fetch
    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]
        if (firstEntry.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const words = data?.pages.flatMap((page) => page.words) ?? []

  // The empty state lives here rather than in the parent: the list must always
  // mount, or the query has nowhere to write the first Word into.
  if (words.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No words yet. Add one above to start reviewing.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {words.map((word) => (
        <WordCard key={word.id} word={word} />
      ))}

      {isFetchingNextPage && <WordCardSkeleton />}

      {/* Sentinel indicator & Loading feedback */}
      {hasNextPage && (
        <div
          ref={sentinelRef}
          className="flex justify-center py-4 text-sm text-muted-foreground"
        >
          {isFetchingNextPage ? null : "Scroll down to load more"}
        </div>
      )}
    </div>
  )
}

InfiniteWordList.whyDidYouRender = true
