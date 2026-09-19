"use server"

import { revalidatePath } from "next/cache"

import { isUniqueConstraint, prismaErrorMessage } from "@/lib/db-error"
import type { ReviewIssue } from "@/lib/issues"
import { translateEnglishToVietnamese } from "@/lib/mymemory"
import { prisma } from "@/lib/prisma"

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string }

export type TranslateResult =
  | { ok: true; vietnamese: string }
  | { ok: false; error: string }

export type QuizResult =
  | {
      ok: true
      passed: boolean
      wordPresent: boolean
      feedback: string
      suggestion: string | null
      issues: ReviewIssue[]
      grammarUnavailable: boolean
    }
  | { ok: false; error: string; reason?: "busy" }

export async function translateWord(english: string): Promise<TranslateResult> {
  try {
    const vietnamese = await translateEnglishToVietnamese(english)
    return { ok: true, vietnamese }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Translation failed.",
    }
  }
}

export async function createWord(input: {
  english: string
  vietnamese: string
  example: string
}): Promise<ActionResult> {
  const english = input.english.trim()
  const vietnamese = input.vietnamese.trim()
  const example = input.example.trim()

  if (!english || !vietnamese) {
    return { ok: false, error: "English and Vietnamese are required." }
  }

  try {
    await prisma.word.create({
      data: {
        english,
        vietnamese,
        example: example || null,
      },
    })
  } catch (error) {
    return {
      ok: false,
      error: isUniqueConstraint(error)
        ? "That English word is already saved."
        : prismaErrorMessage(error, "Could not save the word."),
    }
  }

  revalidatePath("/")
  revalidatePath("/review")
  return { ok: true }
}

export async function updateWord(
  id: string,
  input: { vietnamese: string; example: string }
): Promise<ActionResult> {
  const vietnamese = input.vietnamese.trim()
  const example = input.example.trim()

  if (!vietnamese) {
    return { ok: false, error: "Vietnamese is required." }
  }

  try {
    await prisma.word.update({
      where: { id },
      data: {
        vietnamese,
        example: example || null,
      },
    })
  } catch (error) {
    return {
      ok: false,
      error: prismaErrorMessage(error, "Could not update the word."),
    }
  }

  revalidatePath("/")
  revalidatePath("/review")
  return { ok: true }
}

export async function deleteWord(id: string): Promise<ActionResult> {
  try {
    await prisma.word.delete({ where: { id } })
  } catch (error) {
    return {
      ok: false,
      error: prismaErrorMessage(error, "Could not delete the word."),
    }
  }

  revalidatePath("/")
  revalidatePath("/review")
  return { ok: true }
}

