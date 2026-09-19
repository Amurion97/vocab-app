"use server"

import { revalidatePath } from "next/cache"

import { logExpectedError } from "@/lib/app-log"
import { isUniqueConstraint } from "@/lib/db-error"
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
    const message = expectedDbError("createWord", error)
    if (message) {
      return { ok: false, error: message }
    }
    throw error
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
    const message = expectedDbError("updateWord", error)
    if (message) {
      return { ok: false, error: message }
    }
    throw error
  }

  revalidatePath("/")
  revalidatePath("/review")
  return { ok: true }
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

  revalidatePath("/")
  revalidatePath("/review")
  return { ok: true }
}

