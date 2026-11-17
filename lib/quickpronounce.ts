import { logExpectedError } from "@/lib/app-log"

// Server-side helper for the QuickPronounce API. Never import this from a
// client component: it reads the API key from the server environment.

const QUICK_PRONOUNCE_URL = "https://api.quickpronounce.site/v1/pronunciation"
const REQUEST_TIMEOUT_MS = 10_000

export type PronunciationErrorKind =
  | "unconfigured"
  | "unreachable"
  | "quota_exhausted"
  | "upstream_error"
  | "no_audio"

export type PronunciationResult =
  | { ok: true; audioBase64: string; ipa?: string; format: string }
  | { ok: false; kind: PronunciationErrorKind; error: string }

function apiKey() {
  // Match lib/sapling.ts: strip stray wrapping quotes the .env file may keep.
  const raw = process.env.QUICK_PRONOUNCE_API_KEY?.trim()
  if (!raw) {
    return undefined
  }
  const wrapped =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  const unquoted = wrapped ? raw.slice(1, -1) : raw.replace(/^["']/, "")
  return unquoted.trim() || undefined
}

// Upstream wraps its payload: { success, data: { audio: { content, format,
// encoding }, phonetics: { us, uk }, ... } }.
type QuickPronounceResponse = {
  success?: boolean
  data?: {
    audio?: { content?: string; encoding?: string; format?: string }
    phonetics?: { us?: string; uk?: string }
  }
  message?: string
}

export async function fetchPronunciation(
  word: string
): Promise<PronunciationResult> {
  const key = apiKey()
  if (!key) {
    logExpectedError({
      action: "fetchPronunciation",
      message: "Pronunciation service is not configured.",
      word,
    })
    return {
      ok: false,
      kind: "unconfigured",
      error: "Pronunciation service is not configured.",
    }
  }

  let response: Response
  try {
    response = await fetch(
      `${QUICK_PRONOUNCE_URL}/${encodeURIComponent(word)}?accent=us&gender=male&speed=normal`,
      {
        headers: { "X-API-Key": key },
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    )
  } catch (error) {
    logExpectedError({
      action: "fetchPronunciation",
      message: "Pronunciation service is unreachable.",
      word,
      error,
    })
    return {
      ok: false,
      kind: "unreachable",
      error: "Pronunciation service is unreachable.",
    }
  }

  if (!response.ok) {
    const isQuota = response.status === 429
    const kind: PronunciationErrorKind = isQuota
      ? "quota_exhausted"
      : "upstream_error"
    const error = isQuota
      ? "Pronunciation quota is exhausted for today."
      : "Pronunciation service returned an error."
    logExpectedError({
      action: "fetchPronunciation",
      message: error,
      word,
      status: response.status,
    })
    return { ok: false, kind, error }
  }

  const data = (await response
    .json()
    .catch(() => null)) as QuickPronounceResponse | null
  const audioBase64 = data?.data?.audio?.content
  if (!data || typeof audioBase64 !== "string" || audioBase64.length === 0) {
    logExpectedError({
      action: "fetchPronunciation",
      message: "Pronunciation service returned no audio.",
      word,
    })
    return {
      ok: false,
      kind: "no_audio",
      error: "Pronunciation service returned no audio.",
    }
  }

  return {
    ok: true,
    audioBase64,
    format: data.data?.audio?.format || "mp3",
    ipa:
      typeof data.data?.phonetics?.us === "string"
        ? data.data.phonetics.us
        : undefined,
  }
}
