import type { GrammarMatch } from "@/lib/languagetool"

type SaplingEdit = {
  start?: number
  end?: number
  replacement?: string
  description?: string
}

type SaplingResponse = {
  edits?: SaplingEdit[]
}

function saplingApiKey() {
  // Next can leave one unmatched quote on the env value. Sapling keys have none.
  const raw = process.env.SAPLING_API_KEY?.trim()
  if (!raw) {
    return undefined
  }
  const wrapped =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  const unquoted = wrapped ? raw.slice(1, -1) : raw.replace(/^["']/, "")
  return unquoted.trim() || undefined
}

export async function checkSapling(text: string): Promise<GrammarMatch[]> {
  const key = saplingApiKey()
  if (!key) {
    throw new Error("Sapling is unavailable.")
  }

  const response = await fetch("https://api.sapling.ai/api/v1/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      text,
      session_id: crypto.randomUUID(),
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error("Sapling is unavailable.")
  }

  const data = (await response.json()) as SaplingResponse
  const matches: GrammarMatch[] = []

  for (const edit of data.edits ?? []) {
    const replacement = edit.replacement?.trim() ?? ""
    const original =
      typeof edit.start === "number" && typeof edit.end === "number"
        ? text.slice(edit.start, edit.end).trim()
        : ""
    if (!original && !replacement) {
      continue
    }
    const change = original ? `${original} → ${replacement}` : replacement
    const description = edit.description?.trim()
    matches.push({
      message: description ? `${description} ${change}` : change,
    })
  }

  return matches
}
