import { GoogleGenAI } from "@google/genai"

export type UsageCheck = {
  wordPresent: boolean
  usedCorrectly: boolean
  feedback: string
  suggestion: string | null
}

const MODELS = ["gemini-3.6-flash"]

export async function checkWordUsage(params: {
  english: string
  vietnamese: string
  sentence: string
}): Promise<UsageCheck> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("set GEMINI_API_KEY")
  }

  const ai = new GoogleGenAI({ apiKey })
  const prompt = `You are a vocabulary usage checker for English learners.
The student is practicing this word:
English: ${params.english}
Intended meaning (Vietnamese): ${params.vietnamese}

Student sentence:
"""${params.sentence}"""

Grade ONLY whether the target word is used with the intended meaning (collocation and sense). Ignore minor grammar unless it makes the meaning wrong.

Return JSON only with this shape:
{"wordPresent":boolean,"usedCorrectly":boolean,"feedback":string,"suggestion":string|null}

Rules:
- wordPresent is true if the word or a normal inflection appears in the sentence.
- usedCorrectly is true only if wordPresent is true AND the word is used with the intended meaning.
- feedback is one or two short sentences.
- suggestion is a corrected example sentence if usedCorrectly is false, otherwise null.`

  let lastError: unknown

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(20_000),
        },
      })

      return parseUsageCheck(response.text)
    } catch (error) {
      lastError = error
    }
  }

  throw new Error(geminiErrorMessage(lastError))
}

function geminiErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error)
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } }
    if (parsed.error?.message) {
      return parsed.error.message
    }
  } catch {
    // The SDK sometimes throws a JSON blob; fall through to the raw message.
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "Gemini timed out. Try again."
  }
  return raw || "Gemini could not grade that sentence."
}

function parseUsageCheck(text: string | undefined): UsageCheck {
  if (!text) {
    throw new Error("Gemini returned an empty response.")
  }

  const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  const parsed = JSON.parse(jsonText) as Partial<UsageCheck>
  const wordPresent = Boolean(parsed.wordPresent)
  const usedCorrectly = wordPresent && Boolean(parsed.usedCorrectly)

  return {
    wordPresent,
    usedCorrectly,
    feedback:
      typeof parsed.feedback === "string" && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : usedCorrectly
          ? "The word is used with the intended meaning."
          : "The word is not used with the intended meaning.",
    suggestion:
      typeof parsed.suggestion === "string" && parsed.suggestion.trim()
        ? parsed.suggestion.trim()
        : null,
  }
}
