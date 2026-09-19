import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai"

export type UsageCheck = {
  wordPresent: boolean
  usedCorrectly: boolean
  feedback: string
  suggestion: string | null
}

const MODEL = "gemini-3.8-flash"
const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 1000, 2000] as const
const BUSY_MESSAGE = "Usage check is busy. Try again in a moment."

const USAGE_CHECK_SCHEMA = {
  type: "object",
  properties: {
    wordPresent: {
      type: "boolean",
      description:
        "True if the target word or a normal inflection appears in the sentence.",
    },
    usedCorrectly: {
      type: "boolean",
      description:
        "True only if wordPresent is true AND the word is used with the intended meaning (collocation and sense).",
    },
    feedback: {
      type: "string",
      description: "One or two short sentences explaining the grade.",
    },
    suggestion: {
      type: ["string", "null"],
      description:
        "A corrected example sentence if usedCorrectly is false, otherwise null.",
    },
  },
  required: ["wordPresent", "usedCorrectly", "feedback", "suggestion"],
  additionalProperties: false,
} as const

export class UsageCheckBusyError extends Error {
  constructor() {
    super(BUSY_MESSAGE)
    this.name = "UsageCheckBusyError"
  }
}

export function isUsageCheckBusyError(
  error: unknown
): error is UsageCheckBusyError {
  return (
    error instanceof UsageCheckBusyError ||
    (error instanceof Error && error.name === "UsageCheckBusyError")
  )
}

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

Grade ONLY whether the target word is used with the intended meaning (collocation and sense). Ignore minor grammar unless it makes the meaning wrong.`

  let lastError: unknown

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const delay = BACKOFF_MS[attempt]
    if (delay) {
      await sleep(delay)
    }

    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: USAGE_CHECK_SCHEMA,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(20_000),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })

      return parseUsageCheck(response.text)
    } catch (error) {
      lastError = error
      if (isTimeout(error) || !isRetryableCapacityFailure(error)) {
        break
      }
    }
  }

  if (isBusyFailure(lastError)) {
    console.error("Usage check busy", lastError)
    throw new UsageCheckBusyError()
  }

  throw new Error(geminiErrorMessage(lastError))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isTimeout(error: unknown) {
  return error instanceof Error && error.name === "TimeoutError"
}

function isRetryableCapacityFailure(error: unknown) {
  if (isTimeout(error)) {
    return false
  }
  if (error instanceof ApiError && (error.status === 429 || error.status === 503)) {
    return true
  }
  const raw = error instanceof Error ? error.message : String(error)
  return /429|503|RESOURCE_EXHAUSTED|overloaded|unavailable/i.test(raw)
}

function isBusyFailure(error: unknown) {
  return isTimeout(error) || isRetryableCapacityFailure(error)
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
  if (isTimeout(error)) {
    return "Gemini timed out. Try again."
  }
  return raw || "Gemini could not grade that sentence."
}

function parseUsageCheck(text: string | undefined): UsageCheck {
  if (!text) {
    throw new Error("Gemini returned an empty response.")
  }

  const parsed = JSON.parse(text) as Partial<UsageCheck>
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
