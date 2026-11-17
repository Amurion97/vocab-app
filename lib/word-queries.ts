import { infiniteQueryOptions } from "@tanstack/react-query"
import type { InfiniteData, QueryClient } from "@tanstack/react-query"
import type { Word } from "@prisma/client"

import { fetchMoreWords } from "@/app/actions"

export const WORDS_PAGE_SIZE = 10

/** One page of the Word list: the same shape `getPaginatedWords` returns. */
export type WordPage = {
  words: Word[]
  nextCursor: string | null
}

export type WordsData = InfiniteData<WordPage, string | null | undefined>

// One key for one list. The list and every mutation read it from here so they
// cannot disagree about what they are patching.
export const wordKeys = {
  all: ["words"] as const,
}

/** Server-fetched page one, as TanStack Query's `initialData`. */
export function wordsInitialData(page: WordPage): WordsData {
  return { pages: [page], pageParams: [undefined] }
}

export const wordsQueryOptions = infiniteQueryOptions({
  queryKey: wordKeys.all,
  queryFn: async ({ pageParam }) => {
    const result = await fetchMoreWords(WORDS_PAGE_SIZE, pageParam ?? undefined)
    if (!result.ok) {
      throw new Error(result.error)
    }
    return { words: result.words, nextCursor: result.nextCursor }
  },
  initialPageParam: undefined as string | null | undefined,
  // `null` from `getPaginatedWords` means the list is exhausted.
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})

/** Insert a new Word at the top of page zero. */
export function prependWord(queryClient: QueryClient, word: Word) {
  queryClient.setQueryData<WordsData>(wordKeys.all, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page, index) =>
            index === 0
              ? {
                  ...page,
                  // Filter first: the server render and this patch can both
                  // deliver the same Word, and duplicate keys break the list.
                  words: [word, ...page.words.filter((w) => w.id !== word.id)],
                }
              : page
          ),
        }
      : old
  )
}

/** Replace a Word by id wherever it sits across the loaded pages. */
export function patchWord(queryClient: QueryClient, word: Word) {
  queryClient.setQueryData<WordsData>(wordKeys.all, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            words: page.words.map((item) =>
              item.id === word.id ? word : item
            ),
          })),
        }
      : old
  )
}

/** Drop a Word by id from every loaded page. */
export function removeWord(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<WordsData>(wordKeys.all, (old) =>
    old
      ? {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            words: page.words.filter((item) => item.id !== id),
          })),
        }
      : old
  )
}

/** Restore a snapshot taken before an optimistic patch. */
export function restoreWords(queryClient: QueryClient, snapshot?: WordsData) {
  if (snapshot) {
    queryClient.setQueryData<WordsData>(wordKeys.all, snapshot)
  }
}

export function getWordsSnapshot(queryClient: QueryClient) {
  return queryClient.getQueryData<WordsData>(wordKeys.all)
}
