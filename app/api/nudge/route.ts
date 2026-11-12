import { NextRequest, NextResponse } from "next/server"

import { nudgeSender } from "@/lib/email"
import { decideNudge } from "@/lib/nudge"
import { prisma } from "@/lib/prisma"
import { getNextReviewWord } from "@/lib/words"

function cronSecret(): string | undefined {
  const raw = process.env.CRON_SECRET?.trim()
  if (!raw) {
    return undefined
  }
  const wrapped =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  const unquoted = wrapped ? raw.slice(1, -1) : raw.replace(/^["']/, "")
  return unquoted.trim() || undefined
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

async function findLastReviewedAt(): Promise<Date | null> {
  const aggregate = await prisma.word.aggregate({
    _max: { lastReviewedAt: true },
  })
  return aggregate._max.lastReviewedAt ?? null
}

export async function POST(request: NextRequest) {
  const expected = cronSecret()
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 500 }
    )
  }

  const auth = request.headers.get("Authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : ""

  if (!timingSafeEqual(token, expected)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized." },
      { status: 401 }
    )
  }

  try {
    const result = await decideNudge({
      now: new Date(),
      findLastReviewedAt,
      pickWord: async () => getNextReviewWord(),
      send: nudgeSender(),
      baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      to: process.env.NUDGE_TO_EMAIL ?? "",
      from: process.env.NUDGE_FROM_EMAIL ?? "",
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not send nudge."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
