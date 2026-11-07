import assert from "node:assert/strict"
import test from "node:test"

import { checkSapling } from "../lib/sapling"
import type { GrammarMatch } from "../lib/languagetool"

const sentence = "He go to school"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

async function withFetch(fetchImpl: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

type Call = { url: string; init: RequestInit | undefined }

function recordingFetch(respond: () => Response) {
  const calls: Call[] = []
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return respond()
  }) as typeof fetch
  return { calls, fetchImpl }
}

async function suggestionsFor(text: string, edits: unknown[]) {
  const previous = process.env.SAPLING_API_KEY
  process.env.SAPLING_API_KEY = "test-key"
  let result: GrammarMatch[] = []
  try {
    await withFetch(
      async () => jsonResponse({ edits }),
      async () => {
        result = await checkSapling(text)
      }
    )
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }
  return result
}

test("a replacement edit quotes the flagged word and offers the replacement", async () => {
  const [suggestion] = await suggestionsFor(sentence, [
    {
      start: 3,
      end: 5,
      replacement: "goes",
      description: "Subject-verb agreement",
      sentence,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Subject-verb agreement go → goes")
  assert.equal(
    suggestion.message.slice(
      suggestion.highlight?.offset,
      (suggestion.highlight?.offset ?? 0) + (suggestion.highlight?.length ?? 0)
    ),
    "go"
  )
  assert.deepEqual(suggestion.quote, {
    base: "Subject-verb agreement",
    word: "go",
    context: sentence,
    highlight: { offset: 3, length: 2 },
  })
  assert.equal(
    suggestion.quote.context.slice(
      suggestion.quote.highlight.offset,
      suggestion.quote.highlight.offset + suggestion.quote.highlight.length
    ),
    "go"
  )
  assert.deepEqual(suggestion.replacements, ["goes"])
})

test("a span that includes surrounding space still highlights the word", async () => {
  const [suggestion] = await suggestionsFor(sentence, [
    {
      start: 2,
      end: 6,
      replacement: "goes",
      description: "Subject-verb agreement",
      sentence,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Subject-verb agreement go → goes")
  assert.equal(suggestion.quote?.word, "go")
  assert.equal(
    suggestion.quote?.context?.slice(
      suggestion.quote.highlight?.offset,
      (suggestion.quote.highlight?.offset ?? 0) +
        (suggestion.quote.highlight?.length ?? 0)
    ),
    "go"
  )
  assert.deepEqual(suggestion.quote?.highlight, { offset: 3, length: 2 })
})

test("a sentence with surrounding space highlights the word in the trimmed context", async () => {
  const padded = " He go to school"
  const [suggestion] = await suggestionsFor(padded, [
    {
      start: 4,
      end: 6,
      replacement: "goes",
      description: "Subject-verb agreement",
      sentence: padded,
      sentence_start: 0,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.quote?.context, "He go to school")
  assert.deepEqual(suggestion.quote?.highlight, { offset: 3, length: 2 })
  assert.equal(
    suggestion.quote?.context.slice(
      suggestion.quote.highlight?.offset,
      (suggestion.quote.highlight?.offset ?? 0) +
        (suggestion.quote.highlight?.length ?? 0)
    ),
    "go"
  )
})

test("edits that are not usable are dropped", async () => {
  const suggestions = await suggestionsFor(sentence, [
    null,
    "nope",
    {},
    {
      start: 3,
      end: 5,
      replacement: "goes",
      description: "Subject-verb agreement",
      sentence,
    },
  ])

  assert.equal(suggestions.length, 1)
  assert.equal(suggestions[0]?.message, "Subject-verb agreement go → goes")
})

test("a payload whose edits field is not a list is no suggestions", async () => {
  const previous = process.env.SAPLING_API_KEY
  process.env.SAPLING_API_KEY = "test-key"
  try {
    await withFetch(
      async () =>
        jsonResponse({
          edits: { start: 3, end: 5, replacement: "goes" },
        }),
      async () => {
        assert.deepEqual(await checkSapling(sentence), [])
      }
    )
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }
})

test("a deletion quotes the word and offers no replacement", async () => {
  const books = "I have a books"
  const [suggestion] = await suggestionsFor(books, [
    {
      start: 7,
      end: 8,
      replacement: "",
      description: "Extra article",
      sentence: books,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Extra article a → ")
  assert.equal(suggestion.replacements, undefined)
  assert.deepEqual(suggestion.quote, {
    base: "Extra article",
    word: "a",
    context: books,
    highlight: { offset: 7, length: 1 },
  })
  assert.equal(
    suggestion.message.slice(
      suggestion.highlight?.offset,
      (suggestion.highlight?.offset ?? 0) + (suggestion.highlight?.length ?? 0)
    ),
    "a"
  )
})

test("a later sentence highlights the reported word, not an earlier copy", async () => {
  const text = "Go now. He go to school"
  const excerpt = "He go to school"
  const [suggestion] = await suggestionsFor(text, [
    {
      start: 11,
      end: 13,
      replacement: "goes",
      description: "Subject-verb agreement",
      sentence: excerpt,
      sentence_start: 8,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.quote?.context, excerpt)
  assert.equal(suggestion.quote?.word, "go")
  assert.deepEqual(suggestion.quote?.highlight, { offset: 3, length: 2 })
  assert.equal(suggestion.quote?.context.slice(3, 5), "go")
})

test("a punctuation insertion quotes the word and offers the punctuated replacement", async () => {
  const however = "However we left"
  const [suggestion] = await suggestionsFor(however, [
    {
      start: 0,
      end: 7,
      replacement: "However,",
      description: "Missing comma",
      sentence: however,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Missing comma However → However,")
  assert.deepEqual(suggestion.replacements, ["However,"])
  assert.equal(
    suggestion.message.slice(
      suggestion.highlight?.offset,
      (suggestion.highlight?.offset ?? 0) + (suggestion.highlight?.length ?? 0)
    ),
    "However"
  )
  assert.deepEqual(suggestion.quote?.highlight, { offset: 0, length: 7 })
})

test("an edit with no description still quotes the word", async () => {
  const [suggestion] = await suggestionsFor(sentence, [
    { start: 3, end: 5, replacement: "goes", sentence },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "go → goes")
  assert.equal(suggestion.quote?.base, "Suggested edit:")
  assert.equal(suggestion.quote?.word, "go")
  assert.equal(
    suggestion.message.slice(
      suggestion.highlight?.offset,
      (suggestion.highlight?.offset ?? 0) + (suggestion.highlight?.length ?? 0)
    ),
    "go"
  )
})

test("a zero-length insertion offers the replacement and no highlight", async () => {
  const however = "However we left"
  const [suggestion] = await suggestionsFor(however, [
    {
      start: 7,
      end: 7,
      replacement: ",",
      description: "Missing comma",
      sentence: however,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Missing comma ,")
  assert.equal(suggestion.highlight, undefined)
  assert.equal(suggestion.quote, undefined)
  assert.deepEqual(suggestion.replacements, [","])
})

test("a Sapling response that is not ok throws", async () => {
  const previous = process.env.SAPLING_API_KEY
  process.env.SAPLING_API_KEY = "test-key"
  try {
    for (const status of [401, 500]) {
      await withFetch(
        async () => jsonResponse({ edits: [] }, status),
        async () => {
          await assert.rejects(checkSapling(sentence), {
            message: "Sapling is unavailable.",
          })
        }
      )
    }
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }
})

test("checkSapling posts the sentence as JSON and sends the key without wrapping quotes", async () => {
  const previous = process.env.SAPLING_API_KEY
  process.env.SAPLING_API_KEY = '"sapling-key"'
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse({ edits: [] }))
  try {
    await withFetch(fetchImpl, async () => {
      assert.deepEqual(await checkSapling(sentence), [])
    })
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }

  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call.url, "https://api.sapling.ai/api/v1/edits")
  assert.equal(call.init?.method, "POST")
  assert.equal(call.init?.cache, "no-store")
  assert.deepEqual(call.init?.headers, {
    "Content-Type": "application/json",
    Authorization: "Bearer sapling-key",
  })
  const body = JSON.parse(String(call.init?.body)) as {
    text?: string
    session_id?: string
  }
  assert.equal(body.text, sentence)
  assert.equal(typeof body.session_id, "string")
  assert.notEqual(body.session_id, "")
})

test("a key with one unmatched wrapping quote is still sent unquoted", async () => {
  const previous = process.env.SAPLING_API_KEY
  process.env.SAPLING_API_KEY = '"sapling-key'
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse({ edits: [] }))
  try {
    await withFetch(fetchImpl, async () => {
      await checkSapling(sentence)
    })
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }

  assert.equal(
    calls[0]?.init?.headers &&
      (calls[0].init.headers as Record<string, string>).Authorization,
    "Bearer sapling-key"
  )
})

test("a null payload is no suggestions", async () => {
  const previous = process.env.SAPLING_API_KEY
  process.env.SAPLING_API_KEY = "test-key"
  try {
    await withFetch(
      async () => jsonResponse(null),
      async () => {
        assert.deepEqual(await checkSapling(sentence), [])
      }
    )
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }
})

test("a missing Sapling key throws before the request", async () => {
  const previous = process.env.SAPLING_API_KEY
  delete process.env.SAPLING_API_KEY
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse({ edits: [] }))
  try {
    await withFetch(fetchImpl, async () => {
      await assert.rejects(checkSapling(sentence), {
        message: "Sapling is unavailable.",
      })
    })
  } finally {
    if (previous === undefined) {
      delete process.env.SAPLING_API_KEY
    } else {
      process.env.SAPLING_API_KEY = previous
    }
  }
  assert.equal(calls.length, 0)
})

test("an empty edit list is no suggestions", async () => {
  assert.deepEqual(await suggestionsFor(sentence, []), [])
})

test("an article edit quotes the article and offers the replacement", async () => {
  const apple = "She ate a apple"
  const [suggestion] = await suggestionsFor(apple, [
    {
      start: 8,
      end: 9,
      replacement: "an",
      description: "Wrong article",
      sentence: apple,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Wrong article a → an")
  assert.deepEqual(suggestion.replacements, ["an"])
  assert.deepEqual(suggestion.quote, {
    base: "Wrong article",
    word: "a",
    context: apple,
    highlight: { offset: 8, length: 1 },
  })
})

test("a spelling edit quotes the misspelled word inside the sentence", async () => {
  const spelling = "using worker threds"
  const [suggestion] = await suggestionsFor(spelling, [
    {
      start: 13,
      end: 19,
      replacement: "threads",
      description: "Spelling",
      sentence: spelling,
    },
  ])

  assert.ok(suggestion)
  assert.equal(suggestion.message, "Spelling threds → threads")
  assert.deepEqual(suggestion.replacements, ["threads"])
  assert.deepEqual(suggestion.quote, {
    base: "Spelling",
    word: "threds",
    context: spelling,
    highlight: { offset: 13, length: 6 },
  })
  assert.equal(
    suggestion.message.slice(
      suggestion.highlight?.offset,
      (suggestion.highlight?.offset ?? 0) + (suggestion.highlight?.length ?? 0)
    ),
    "threds"
  )
})
