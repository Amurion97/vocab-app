"use server"

import { revalidatePath } from "next/cache"

import { logExpectedError } from "@/lib/app-log"
import { isUniqueConstraint } from "@/lib/db-error"
import type { GrammarCheckSection, ReviewIssue } from "@/lib/issues"
import { translateEnglishToVietnamese } from "@/lib/clients/mymemory"
import { prisma } from "@/lib/prisma"
import {
  createWordSchema,
  fetchMoreWordsSchema,
  updateWordSchema,
} from "@/lib/word-schemas"
import { getPaginatedWords } from "@/lib/words"
import { Word } from "@prisma/client"

export type ActionResult = { ok: true } | { ok: false; error: string }

export type CreateWordResult =
  { ok: true; word: Word } | { ok: false; error: string }

export type UpdateWordResult =
  { ok: true; word: Word } | { ok: false; error: string }

export type TranslateResult =
  { ok: true; vietnamese: string } | { ok: false; error: string }

export type QuizResult =
  | {
      ok: true
      passed: boolean
      wordPresent: boolean
      feedback: string
      suggestion: string | null
      issues: ReviewIssue[]
      grammarChecks: GrammarCheckSection[]
    }
  | { ok: false; error: string; reason?: "busy" }

function prismaCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === "string" ? code : undefined
  }
}

function expectedDbError(action: string, error: unknown) {
  if (isUniqueConstraint(error)) {
    logExpectedError({ action, error, code: "P2002" })
    return "That English word is already saved."
  }

  const code = prismaCode(error)
  if (code === "P1001" || code === "P2024") {
    logExpectedError({ action, error, code })
    return "Database is waking up or busy. Try saving again."
  }

  if (code === "P2025") {
    logExpectedError({ action, error, code })
    return "That word is no longer saved."
  }
}

export async function translateWord(english: string): Promise<TranslateResult> {
  return translateEnglishToVietnamese(english)
}

export async function createWord(input: {
  english: string
  vietnamese: string
  example: string
}): Promise<CreateWordResult> {
  const parsed = createWordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: "English and Vietnamese are required." }
  }

  const { english, vietnamese, example } = parsed.data
  let word: Word
  try {
    word = await prisma.word.create({
      data: {
        english,
        vietnamese,
        example: example || null,
      },
    })
  } catch (error) {
    const message = expectedDbError("createWord", error)
    if (message) {
      return { ok: false, error: message }
    }
    throw error
  }

  revalidatePath("/review")
  return { ok: true, word }
}

export async function fetchMoreWords(limit: number, cursor?: string) {
  const parsed = fetchMoreWordsSchema.safeParse({ limit, cursor })
  if (!parsed.success) {
    return { ok: false as const, error: "Failed to load more words." }
  }

  try {
    const result = await getPaginatedWords(
      parsed.data.limit,
      parsed.data.cursor
    )
    return { ok: true as const, ...result }
  } catch (error) {
    console.error("Failed to fetch more words:", error)
    return { ok: false as const, error: "Failed to load more words." }
  }
}

export async function updateWord(
  id: string,
  input: { vietnamese: string; example: string }
): Promise<UpdateWordResult> {
  const parsed = updateWordSchema.safeParse({ id, ...input })
  if (!parsed.success) {
    return { ok: false, error: "Vietnamese is required." }
  }

  const { vietnamese, example } = parsed.data
  let word: Word
  try {
    word = await prisma.word.update({
      where: { id: parsed.data.id },
      data: {
        vietnamese,
        example: example || null,
      },
    })
  } catch (error) {
    const message = expectedDbError("updateWord", error)
    if (message) {
      return { ok: false, error: message }
    }
    throw error
  }

  revalidatePath("/review")
  return { ok: true, word }
}

export async function deleteWord(id: string): Promise<ActionResult> {
  try {
    await prisma.word.delete({ where: { id } })
  } catch (error) {
    const message = expectedDbError("deleteWord", error)
    if (message) {
      return { ok: false, error: message }
    }
    throw error
  }

  revalidatePath("/review")
  return { ok: true }
}
