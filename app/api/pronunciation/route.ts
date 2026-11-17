import { NextResponse } from "next/server"

import { logUnexpectedError } from "@/lib/app-log"
import { exhaustiveCheck } from "@/lib/exhaustive-check"
import {
  fetchPronunciation,
  type PronunciationErrorKind,
} from "@/lib/quickpronounce"

// The free QuickPronounce tier allows 50 requests/day, so every hit counts.
// Cache successful lookups in-memory for the life of the server process and
// let browsers/CDNs cache via Cache-Control, sparing the daily quota.
const pronunciationCache = new Map<
  string,
  { audioBase64: string; ipa?: string; format: string }
>()

// Audio for a word never changes, so cache aggressively: 1 day in browsers,
// 1 week on the CDN, and serve stale content while revalidating in background.
const cacheControlHeader =
  "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"

function statusForErrorKind(kind: PronunciationErrorKind): number {
  switch (kind) {
    case "unconfigured":
      return 503
    case "unreachable":
      return 504
    case "quota_exhausted":
      return 429
    case "upstream_error":
    case "no_audio":
      return 502
    default:
      return exhaustiveCheck(kind)
  }
}

export async function GET(request: Request) {
  try {
    const word = new URL(request.url).searchParams.get("word")?.trim() ?? ""
    if (!word || word.length > 100) {
      return NextResponse.json(
        { ok: false, error: "A word of 1-100 characters is required." },
        { status: 400 }
      )
    }

    const normalized = word.toLowerCase()
    const cached = pronunciationCache.get(normalized)
    if (cached) {
      return NextResponse.json(
        { ok: true, ...cached },
        { headers: { "Cache-Control": cacheControlHeader } }
      )
    }

    const result = await fetchPronunciation(normalized)
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: statusForErrorKind(result.kind) }
      )
    }

    const payload = {
      audioBase64: result.audioBase64,
      ipa: result.ipa,
      format: result.format,
    }
    pronunciationCache.set(normalized, payload)

    return NextResponse.json(
      { ok: true, ...payload },
      { headers: { "Cache-Control": cacheControlHeader } }
    )
  } catch (error) {
    logUnexpectedError({
      action: "pronunciationRoute",
      error,
    })
    return NextResponse.json(
      { ok: false, error: "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
