// Server-side helper for the QuickPronounce API. Never import this from a
// client component: it reads the API key from the server environment.

const QUICK_PRONOUNCE_URL = "https://api.quickpronounce.site/v1/pronunciation"
const REQUEST_TIMEOUT_MS = 10_000

export type PronunciationResult =
  { ok: true; audioBase64: string; ipa?: string } | { ok: false; error: string }

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
    return { ok: false, error: "Pronunciation service is not configured." }
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
  } catch {
    return { ok: false, error: "Pronunciation service is unreachable." }
  }

  if (!response.ok) {
    return {
      ok: false,
      error:
        response.status === 429
          ? "Pronunciation quota is exhausted for today."
          : "Pronunciation service returned an error.",
    }
  }

  const data = (await response
    .json()
    .catch(() => null)) as QuickPronounceResponse | null
  const audioBase64 = data?.data?.audio?.content
  if (!data || typeof audioBase64 !== "string" || audioBase64.length === 0) {
    return { ok: false, error: "Pronunciation service returned no audio." }
  }

  return {
    ok: true,
    audioBase64,
    ipa:
      typeof data.data?.phonetics?.us === "string"
        ? data.data.phonetics.us
        : undefined,
  }
}
