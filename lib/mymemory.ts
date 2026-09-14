type MyMemoryResponse = {
  responseStatus?: number
  responseData?: { translatedText?: string }
  responseDetails?: string
}

export async function translateEnglishToVietnamese(text: string) {
  const query = text.trim()
  if (!query) {
    throw new Error("Enter an English word to translate.")
  }

  const url = new URL("https://api.mymemory.translated.net/get")
  url.searchParams.set("q", query)
  url.searchParams.set("langpair", "en|vi")

  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Translation service is unavailable.")
  }

  const data = (await response.json()) as MyMemoryResponse
  const translated = data.responseData?.translatedText?.trim()

  if (!translated || data.responseStatus !== 200) {
    throw new Error(
      typeof data.responseDetails === "string"
        ? data.responseDetails
        : "Could not translate that word."
    )
  }

  return translated
}
