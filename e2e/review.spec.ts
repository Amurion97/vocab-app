import type { Prisma, Word } from "@prisma/client"
import { expect, test, type Page } from "@playwright/test"

import { prisma } from "@/lib/dal"

const PASS_WORD = {
  english: "ubiquitous",
  vietnamese: "có ở khắp nơi",
}

const FAIL_WORD = {
  english: "ephemeral",
  vietnamese: "phù du",
}

const hasLiveEnv =
  Boolean(process.env.GEMINI_API_KEY?.trim()) &&
  Boolean(process.env.DATABASE_URL?.trim())

test.describe("review flow (live API)", () => {
  // The server retries Gemini up to 3 attempts of 20s with backoff, so a
  // degraded API can take over a minute to settle into a result or "busy".
  test.describe.configure({ timeout: 120_000 })

  test.skip(
    !hasLiveEnv,
    "Set GEMINI_API_KEY and DATABASE_URL to run live review e2e tests."
  )

  let seededWordId: string | undefined
  let originalWordSnapshot: Word | null = null

  async function seedWord(data: { english: string; vietnamese: string }) {
    const existing = await prisma.word.findUnique({
      where: { english: data.english },
    })

    if (existing) {
      // User already has this word: snapshot it so we can restore it completely.
      originalWordSnapshot = existing
      seededWordId = existing.id
      // Align meaning and reset lastReviewedAt so review page renders the quiz card.
      await prisma.word.update({
        where: { id: existing.id },
        data: {
          vietnamese: data.vietnamese,
          lastReviewedAt: null,
        },
      })
      return existing
    }

    // Word did not exist: create it as a temporary test record.
    originalWordSnapshot = null
    const word = await prisma.word.create({
      data: {
        english: data.english,
        vietnamese: data.vietnamese,
        lastReviewedAt: null,
      },
    })
    seededWordId = word.id
    return word
  }

  test.afterEach(async () => {
    if (originalWordSnapshot) {
      // Restore user's real word and all study history
      await prisma.word.update({
        where: { id: originalWordSnapshot.id },
        data: {
          vietnamese: originalWordSnapshot.vietnamese,
          example: originalWordSnapshot.example,
          timesReviewed: originalWordSnapshot.timesReviewed,
          timesCorrect: originalWordSnapshot.timesCorrect,
          timesWrong: originalWordSnapshot.timesWrong,
          lastSentence: originalWordSnapshot.lastSentence,
          lastPassed: originalWordSnapshot.lastPassed,
          lastReviewedAt: originalWordSnapshot.lastReviewedAt,
          issues: (originalWordSnapshot.issues ?? []) as Prisma.InputJsonValue,
        },
      })
      originalWordSnapshot = null
      seededWordId = undefined
    } else if (seededWordId) {
      // Created by this test; delete it
      await prisma.word.deleteMany({ where: { id: seededWordId } })
      seededWordId = undefined
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  async function openSeededReview(page: Page) {
    if (!seededWordId) {
      throw new Error("No seeded word available to open.")
    }
    await page.goto(`/review?word=${seededWordId}`)
  }

  test("passing review flow persists lastReviewedAt", async ({ page }) => {
    await seedWord(PASS_WORD)
    await openSeededReview(page)

    await expect(page.getByRole("heading", { name: "Review" })).toBeVisible()
    await expect(
      page.getByText(PASS_WORD.english, { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(`Vietnamese meaning: ${PASS_WORD.vietnamese}`)
    ).toBeVisible()

    const checkButton = page.getByRole("button", { name: "Check usage" })
    await expect(checkButton).toBeDisabled()

    await page
      .getByLabel("Write a sentence using this word")
      .fill("Smartphones have become ubiquitous in modern daily life.")
    await page.getByLabel("LanguageTool").check()
    await expect(checkButton).toBeEnabled()
    await checkButton.click()

    // Live API call; assert on the settled result, not the Checking… state.
    // Allow more than the server's 3x20s + backoff retry budget.
    // Exact text: the busy alert says "Try again in a moment.", which would
    // otherwise substring-match these filters.
    await expect(
      page
        .getByRole("alert")
        .filter({ has: page.getByText("Passed", { exact: true }) })
    ).toBeVisible({ timeout: 90_000 })
    await expect(
      page
        .getByRole("alert")
        .filter({ has: page.getByText("LanguageTool", { exact: true }) })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Next word" })).toBeVisible()

    // lastReviewedAt persisted: the same URL now renders the congrats card.
    await page.reload()
    await expect(page.getByText("All caught up on this word")).toBeVisible()
  })

  test("failed check shows feedback and try again resets the form", async ({
    page,
  }) => {
    await seedWord(FAIL_WORD)
    await openSeededReview(page)

    await expect(
      page.getByText(FAIL_WORD.english, { exact: true })
    ).toBeVisible()

    await page
      .getByLabel("Write a sentence using this word")
      .fill("The weather is nice today.")
    await page.getByLabel("LanguageTool").check()
    await page.getByRole("button", { name: "Check usage" }).click()

    await expect(
      page
        .getByRole("alert")
        .filter({ has: page.getByText("Try again", { exact: true }) })
    ).toBeVisible({ timeout: 90_000 })
    await expect(
      page.getByText("The target word was not found in your sentence.")
    ).toBeVisible()

    await page.getByRole("button", { name: "Try again" }).click()

    const sentence = page.getByLabel("Write a sentence using this word")
    await expect(sentence).toBeEditable()
    // The sentence is kept so the learner can edit it and resubmit.
    await expect(sentence).toHaveValue("The weather is nice today.")
  })
})
