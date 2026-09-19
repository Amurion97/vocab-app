import { logExpectedError } from "@/lib/app-log"

type MyMemoryResponse = {
  responseStatus?: number
  responseData?: { translatedText?: string }
  responseDetails?: string
}

export type TranslateWordResult =
  | { ok: true; vietnamese: string }
  | { ok: false; error: string }

export async function translateEnglishToVietnamese(
  text: string
): Promise<TranslateWordResult> {
  const query = text.trim()
  if (!query) {
    return { ok: false, error: "Enter an English word to translate." }
  }

  const url = new URL("https://api.mymemory.translated.net/get")
  url.searchParams.set("q", query)
  url.searchParams.set("langpair", "en|vi")

  let response: Response
  try {
    response = await fetch(url, { cache: "no-store" })
  } catch (error) {
    logExpectedError({
      action: "translateWord",
      message: "Translation service is unavailable.",
      query,
      error,
    })
    return { ok: false, error: "Translation service is unavailable." }
  }

  if (!response.ok) {
    const body = (await response.text()).slice(0, 500)
    logExpectedError({
      action: "translateWord",
      message: "Translation service is unavailable.",
      query,
      status: response.status,
      body,
    })
    return { ok: false, error: "Translation service is unavailable." }
  }

  const data = (await response.json()) as MyMemoryResponse
  const translated = data.responseData?.translatedText?.trim()

  if (!translated || data.responseStatus !== 200) {
    const error =
      typeof data.responseDetails === "string"
        ? data.responseDetails
        : "Could not translate that word."
    logExpectedError({
      action: "translateWord",
      message: error,
      query,
      status: data.responseStatus,
    })
    return { ok: false, error }
  }

  return { ok: true, vietnamese: translated }
}
