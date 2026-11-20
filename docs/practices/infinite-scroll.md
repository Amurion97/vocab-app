# Practice Guide: Implementing Infinite Scroll for Saved Words

This guide outlines a performant, production-ready pattern for implementing **Infinite Scroll** on the homepage (`app/page.tsx`) using Next.js (App Router), Prisma, TanStack Query, and the native browser `IntersectionObserver` API.

> TanStack Query owns the word list on the client. See
> `docs/adr/0001-tanstack-query-owns-the-word-list.md` for why.

---

## Why Infinite Scroll?

Currently, the homepage renders all saved words at once. As the vocabulary list grows to hundreds or thousands of words:
1. **Initial Page Load** slows down because of massive Server Component payloads.
2. **DOM Nodes** proliferate, slowing down browser style recalculation, layout, and memory usage, especially since each `WordCard` is a `"use client"` component containing interactive buttons, dialog states, and transition forms.
3. **Database Overhead** increases as the application fetches unnecessary rows that the user hasn't scrolled to see.

---

## Step-by-Step Implementation

### Step 1: Update `lib/words.ts` with Cursor-Based Pagination

For infinite scroll lists, **cursor-based pagination** is highly recommended over offset-based pagination. It avoids duplicate or skipped items when new words are created at the top of the list while a user is scrolling.

Add a paginated version of `getWords` to `lib/words.ts`:

```typescript
// lib/words.ts

export async function getPaginatedWords(limit = 10, cursor?: string) {
  const words = await prisma.word.findMany({
    take: limit,
    ...(cursor && {
      skip: 1, // Skip the cursor element itself
      cursor: { id: cursor },
    }),
    orderBy: { createdAt: "desc" },
  })

  // A full page means there is probably another one; a short page ends the list.
  const nextCursor = words.length === limit ? words[words.length - 1].id : null

  return {
    words,
    nextCursor,
  }
}
```

`null` is the end-of-list signal. It is not optional bookkeeping: `getNextPageParam` passes it straight to TanStack Query, which treats `null` as "no next page".

### Step 2: Create a Server Action for Fetching Batches

To support dynamic loading on the client side without traditional route handlers, we use a Next.js **Server Action**.

Create or update `app/actions.ts` to include:

```typescript
// app/actions.ts
"use server"

import { getPaginatedWords } from "@/lib/words"

export async function fetchMoreWords(limit: number, cursor?: string) {
  try {
    const result = await getPaginatedWords(limit, cursor)
    return { ok: true as const, ...result }
  } catch (error) {
    console.error("Failed to fetch more words:", error)
    return { ok: false as const, error: "Failed to load more words." }
  }
}
```

### Step 3: Define the query key and page shape

Put the query in one shared factory so the list and every mutation read the same key. Mutations that invent their own key silently patch nothing.

```typescript
// lib/word-queries.ts
import { infiniteQueryOptions } from "@tanstack/react-query"
import { fetchMoreWords } from "@/app/actions"

export const wordKeys = {
  all: ["words"] as const,
}

export const wordsQueryOptions = infiniteQueryOptions({
  queryKey: wordKeys.all,
  queryFn: async ({ pageParam }) => {
    const result = await fetchMoreWords(10, pageParam ?? undefined)
    if (!result.ok) {
      throw new Error(result.error)
    }
    return { words: result.words, nextCursor: result.nextCursor }
  },
  initialPageParam: undefined as string | null | undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})
```

The page shape is whatever `fetchMoreWords` already returns, `{ words, nextCursor }`, so the existing Server Action works as the `queryFn` unmodified.

### Step 4: Create the Client-Side Infinite List Component

Create a client-side wrapper `components/infinite-word-list.tsx` that reads from the query, renders the flattened pages, and monitors a sentinel element using `IntersectionObserver`.

```tsx
// components/infinite-word-list.tsx
"use client"

import { useEffect, useRef } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { WordCard, WordCardSkeleton } from "@/components/word-card"
import {
  wordsInitialData,
  wordsQueryOptions,
  type WordPage,
} from "@/lib/word-queries"

export function InfiniteWordList({ initialPage }: { initialPage: WordPage }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      ...wordsQueryOptions,
      // Must be { pages, pageParams }: any other shape refetches page one on mount.
      initialData: wordsInitialData(initialPage),
    })

  // Sentinel element ref to observe scrolling
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
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

  // The empty state lives here, not in the parent. If the parent returns a
  // paragraph instead of mounting this component, the query has nowhere to
  // write the first Word and a newly added card stays invisible.
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
```

The observer replaces only the cursor and page bookkeeping. The sentinel stays, because it is what turns "the user reached the bottom" into `fetchNextPage()`.

### Step 5: Integrate the Infinite List into `app/page.tsx`

The Server Component fetches page one and passes it down as `initialData`. It does **not** decide whether to render the list — that is the list's job now.

```tsx
// app/page.tsx
import { Suspense } from "react"
import { AddWordForm } from "@/components/add-word-form"
import { InfiniteWordList } from "@/components/infinite-word-list"
import { getPaginatedWords } from "@/lib/words"

async function SavedWordList() {
  const { words, nextCursor } = await getPaginatedWords(10)

  // Always mount the list, even with zero words: the empty state renders from
  // inside it so the query has somewhere to put the first Word.
  return <InfiniteWordList initialPage={{ words, nextCursor }} />
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

        <Suspense fallback={<WordCardSkeleton />}>
          <SavedWordList />
        </Suspense>
      </section>
    </div>
  )
}
```

### Step 6: Keep mutations in the cache, not the server render

Mutations are Server Actions that return the affected **Word**, and the client patches the cache with `setQueryData`. Do not call `revalidatePath("/")` for this list: the query cache owns it, and a revalidation only produces a fresh server render the cache is free to ignore.

```typescript
// lib/word-queries.ts
export function prependWord(queryClient: QueryClient, word: Word) {
  queryClient.setQueryData<WordsData>(wordKeys.all, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page, index) =>
            index === 0
              ? // Filter first: the server render and this patch can both
                // deliver the same Word, and duplicate keys break the list.
                { ...page, words: [word, ...page.words.filter((w) => w.id !== word.id)] }
              : page
          ),
        }
      : old
  )
}
```

- **Create** — prepend into `pages[0].words`. `getPaginatedWords` orders `createdAt: "desc"`, so new words belong at the top. Use `setQueryData`, not `invalidateQueries`: invalidation refetches every loaded page, so a user five pages deep pays five round trips to see one new word.
- **Update** — patch by `id` across `pages`, restoring a snapshot on failure.
- **Delete** — soft delete in-place: the card stays mounted and in the query cache during deletion (faded out via `isDeleting`), while the confirmation dialog displays any errors. Once confirmed by the server, close the dialog, remove the word from the cache (`removeWord`), and `invalidateQueries({ queryKey: wordKeys.all })` to refetch clean cursor boundaries. This prevents dangling cursors, page desync, snapshot overwrites, or dropped errors from unmounting.

`revalidatePath("/review")` still belongs in each action: nothing on that route reads the query cache, so it is the only thing that makes a newly saved word reviewable without a reload.

---

## Key Performance Best Practices Applied

1. **`server-serialization`**: Only critical word structures are sent down to the browser.
2. **`rendering-content-visibility`**: For massive lists of words, you can apply CSS performance tricks to the word card containers in your styles or class definitions to avoid heavy off-screen browser layouts:
   ```css
   .word-card-container {
     content-visibility: auto;
     contain-intrinsic-size: 150px; /* Estimated height of WordCard */
   }
   ```
3. **`async-suspense-boundaries`**: Using `<Suspense>` allows the page layout shell and the `AddWordForm` to mount instantaneously while loading components stream in immediately afterward.
4. **Root Margin Cushion**: Using `rootMargin: "200px"` inside the `IntersectionObserver` setup guarantees the user experiences zero lag or skeleton flickers, since subsequent batches fetch slightly before the user completely hits the scroll end.
