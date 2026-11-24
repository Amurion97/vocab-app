---
status: proposed
---

# TanStack Query owns the client-side Word list

The homepage renders **Words** as an infinite list whose first page comes from a Server Component and whose later pages are appended on the client. Mutations (create, update, delete) are Server Actions, so no single thing owns the list the user is looking at. We are adopting TanStack Query as the sole owner of that list on the client, keeping the server fetch only as hydration data, because we have now hit the same class of bug three times trying to hand-roll it.

## Why

`InfiniteWordList` copies its `initialWords` prop into `useState`. That makes the server the source of truth exactly once, at mount. Every later server render — including the one `revalidatePath("/")` triggers after a mutation — hands down fresh props that the component ignores.

Each mutation has therefore grown its own workaround, and each has a defect:

- **Create** pushes the new **Word** into a module-global Zustand store that an effect drains into local state. This produced a `react-hooks/set-state-in-effect` lint error, a missing-dependency warning, and a duplicate React key when the server render and the store push both deliver the same **Word**.
- **Update** and **Delete** call `revalidatePath("/")` and have no workaround at all, so they do not visibly change the list. The edited or deleted card stays on screen until a full reload.

Two more hand-rolled sync paths would mean two more variants of the same trap. A query cache is the thing we keep partially reimplementing, so we should use one.

The usual argument against layering a client cache on the App Router is that it costs server rendering. That cost is largely already paid here: `WordCard` is `"use client"`, so the whole list subtree ships to the browser regardless. What we lose is smaller than it looks, and what we gain is one mechanism instead of three.

## Considered options

**Derive from props instead of copying them.** Make `words` a function of `initialWords` plus accumulated pages, so `revalidatePath` reaches the list. This is the smallest fix and genuinely removes the root cause, but it fixes staleness without giving us instant feedback: every mutation would still wait for a server round trip, and any page the user had scrolled past would be dropped back to page one on each revalidation. Rejected as a stopping point, though it is a reasonable emergency fix if the migration stalls.

**`useOptimistic` plus a lifted callback.** Enough for update and delete, and dependency-free. Rejected because `AddWordForm` and `SavedWordList` are siblings under a Server Component, so create still needs a side channel — which is the Zustand store we are trying to delete.

**Keep the Zustand store and extend it to update and delete.** Rejected: the store holds a queue of pending **Words** that a consumer must remember to drain, and the drain step is where the duplicate-key and effect-cascade bugs live. Extending that shape triples the surface.

## Consequences

- `revalidatePath("/")` comes out of all three mutations, because the query cache, not the server render, now refreshes the list. `revalidatePath("/review")` **stays**: nothing on that route reads the query cache, so it is the only thing that makes a newly saved **Word** reviewable without a reload.
- `stores/added-words.ts` and the `zustand` dependency are deleted.
- The server fetch in `app/page.tsx` becomes `initialData` for the query, not an independent read. If the two ever disagree, the cache wins.
- The artificial 2s delay in `getPaginatedWords` is removed. Left in, it would be paid on every cache miss and make the new instant-feedback path feel slower than the old one.
- We take on a client cache that can disagree with the database between invalidations. That is the explicit trade for instant feedback.

## Glossary note

`CONTEXT.md` defines **Word** and explicitly lists `entry`, `card`, and `item` as terms to avoid. It has no term for "a **Word** added in this session but not yet on screen" — that concept was invented by the Zustand store (`addedWords`) and is an implementation artifact, not domain language. This migration deletes it rather than promoting it to the glossary. New code should name these collections `words`.

---

# Migration plan

Seven steps, ordered so the app keeps working after each one. Steps 1–2 are setup, 3 is the swap, 4–6 are the mutations, 7 is cleanup.

## 1. Add the dependency and the provider

Add `@tanstack/react-query`. Create a `"use client"` provider component holding a `QueryClient` in `useState` (not module scope — a module-scoped client is shared across requests on the server and leaks data between users). Mount it in `app/layout.tsx` inside the existing provider stack.

Default `staleTime` to something non-zero (30s is fine) so remounts don't refetch immediately.

**Done when:** the app builds and renders unchanged. No behaviour change yet.

## 2. Define the query key and page shape

One key: `["words"]`. The page shape is whatever `fetchMoreWords` already returns, `{ words, nextCursor }`, so the existing Server Action works as the `queryFn` unmodified. `getNextPageParam` returns `lastPage.nextCursor`, and a `null` cursor ends pagination — which is already the contract `getPaginatedWords` implements.

Put the query options in one shared factory (e.g. `lib/word-queries.ts`) so the list and the mutations cannot disagree about the key.

**Done when:** the factory exists and type-checks. Nothing consumes it yet.

## 3. Swap `InfiniteWordList` onto `useInfiniteQuery`

Replace the `words` and `cursor` `useState` pair with `useInfiniteQuery`. Flatten `data.pages` into the rendered list.

Three things to get right:

- **`initialData` shape.** `app/page.tsx` already fetches page one; pass it down and feed it in as `{ pages: [{ words, nextCursor }], pageParams: [undefined] }`. Getting this wrong silently causes a duplicate fetch on mount, so verify in the Network tab that mounting fires zero requests.
- **Keep the `IntersectionObserver`.** The query replaces the cursor and page bookkeeping, not the sentinel. The observer callback becomes `fetchNextPage()`, guarded by `hasNextPage && !isFetchingNextPage`. Keep `rootMargin: "200px"`.
- **Move the empty state into this component.** `SavedWordList` currently returns a paragraph instead of mounting the list when there are no **Words**, which is the gap that made the first-ever **Word** invisible. Always mount the list; render the empty paragraph from inside it when the flattened result is empty. This step is what makes the create path work at all.

**Done when:** scrolling still paginates, mounting fires no extra request, and an empty database shows the empty paragraph.

## 4. Create

`createWord` already returns the created **Word**. In `AddWordForm`, replace the `addWord` store call with `setQueryData` on `["words"]` that prepends into `pages[0].words`.

Prepend, not append: `getPaginatedWords` orders `createdAt: "desc"`.

Use `setQueryData` rather than `invalidateQueries`. Invalidation refetches every loaded page, so a user five pages deep pays five round trips to see one new **Word**; patching page zero is instant and avoids it.

**Done when:** saving a **Word** shows it at the top immediately, including the first-ever **Word**, with no duplicate and no 2s wait.

## 5. Update

Have `updateWord` return the updated **Word** (it currently returns bare `{ ok: true }`). In `WordCard`, patch that **Word** by `id` across `pages` via `setQueryData`.

Roll back on error by restoring the snapshot captured before the patch.

**Done when:** editing a **Word** updates the card without a reload, and a forced server error reverts it.

## 6. Delete

In `WordCard`, filter the **Word** out by `id` across `pages` via `setQueryData`, then let the action settle. Same snapshot-and-rollback on failure.

Note the known wrinkle: removing a **Word** that is a page boundary makes the stored `nextCursor` point at a row that no longer exists, and `getPaginatedWords` uses `cursor: { id }` with `skip: 1` to fetch the next page. Confirm by experiment whether Prisma errors or returns an empty page in that case — don't assume. Either way the resolution is the same: invalidate `["words"]` after a delete settles rather than only patching pages. Deletes are rare, so the extra refetch is cheap relative to a broken cursor.

**Done when:** deleting a **Word** removes the card immediately, and deleting the 10th, 20th, or 30th **Word** then scrolling still paginates without error.

## 7. Cleanup

- Delete `stores/added-words.ts` and remove `zustand` from `package.json`.
- Remove `revalidatePath("/")` from `createWord`, `updateWord`, and `deleteWord`. **Keep** `revalidatePath("/review")` in all three.
- Remove the `await new Promise((resolve) => setTimeout(resolve, 2000))` from `getPaginatedWords`.
- Update `docs/practices/infinite-scroll.md`, whose Step 3 and Step 4 now describe the superseded `useState` approach, including the empty-state check that moved in step 3 above.
- Run `bun run lint` and `bun run typecheck`. Lint currently fails on `react-hooks/set-state-in-effect` in `components/infinite-word-list.tsx`; that error should be gone, not suppressed.

**Done when:** lint and typecheck both pass and no file imports `zustand`.
