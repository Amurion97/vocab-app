import assert from "node:assert/strict"
import test from "node:test"

import { checkGrammar, type GrammarMatch } from "../lib/languagetool"

const sentence = "using worker threds"
const fullSentence = "using worker threds and gorutines"
const spellingBase = "Possible spelling mistake found."
const thredsQuote = { base: spellingBase, word: "threds" }
const longSentence =
  "I have been spending the entire afternoon reading about how the scheduler decides to park a worker threds before the queue drains completely and then resumes it later on."

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

async function matchesFor(text: string, matches: unknown[]) {
  let result: GrammarMatch[] = []
  await withFetch(
    async () => jsonResponse({ matches }),
    async () => {
      result = await checkGrammar(text)
    }
  )
  return result
}

// The highlight is only useful if it lands on the word inside the quoted
// context, so assert the slice rather than the numbers.
async function highlightedWordIn(text: string, match: unknown) {
  const [result] = await matchesFor(text, [match])
  if (!result?.highlight) {
    return null
  }
  const { offset, length } = result.highlight
  return result.message.slice(offset, offset + length)
}

async function messagesFor(text: string, matches: unknown[]) {
  let result: string[] = []
  await withFetch(
    async () => jsonResponse({ matches }),
    async () => {
      result = (await checkGrammar(text)).map((match) => match.message)
    }
  )
  return result
}

test("checkGrammar posts the sentence as form-encoded en-US text", async () => {
  const { calls, fetchImpl } = recordingFetch(() =>
    jsonResponse({ matches: [] })
  )

  await withFetch(fetchImpl, async () => {
    await checkGrammar(sentence)
  })

  assert.equal(calls.length, 1)
  const [call] = calls
  assert.equal(call.url, "https://api.languagetool.org/v2/check")
  assert.equal(call.init?.method, "POST")
  assert.deepEqual(call.init?.headers, {
    "Content-Type": "application/x-www-form-urlencoded",
  })
  assert.equal(call.init?.cache, "no-store")

  const body = new URLSearchParams(String(call.init?.body))
  assert.equal(body.get("text"), sentence)
  assert.equal(body.get("language"), "en-US")
})

test("a LanguageTool response that is not ok throws", async () => {
  await withFetch(
    async () => jsonResponse({ matches: [] }, 503),
    async () => {
      await assert.rejects(checkGrammar(sentence), {
        message: "LanguageTool is unavailable.",
      })
    }
  )
})

test("a real LanguageTool response quotes each word inside the whole sentence", async () => {
  assert.deepEqual(
    await messagesFor(fullSentence, [
      {
        message: "This sentence does not start with an uppercase letter.",
        shortMessage: "Capitalization",
        replacements: [{ value: "Using" }],
        offset: 0,
        length: 5,
        context: { text: fullSentence, offset: 0, length: 5 },
        sentence: fullSentence,
        rule: { id: "UPPERCASE_SENTENCE_START" },
      },
      {
        message: "Possible spelling mistake found.",
        shortMessage: "Spelling mistake",
        replacements: [{ value: "threads" }, { value: "shreds" }],
        offset: 13,
        length: 6,
        context: { text: fullSentence, offset: 13, length: 6 },
        sentence: fullSentence,
        rule: { id: "MORFOLOGIK_RULE_EN_US" },
      },
      {
        message: "Possible spelling mistake found.",
        shortMessage: "Spelling mistake",
        replacements: [{ value: "routines" }, { value: "coroutines" }],
        offset: 24,
        length: 9,
        context: { text: fullSentence, offset: 24, length: 9 },
        sentence: fullSentence,
        rule: { id: "MORFOLOGIK_RULE_EN_US" },
      },
    ]),
    [
      `This sentence does not start with an uppercase letter. "using" in "${fullSentence}"`,
      `Possible spelling mistake found. "threds" in "${fullSentence}"`,
      `Possible spelling mistake found. "gorutines" in "${fullSentence}"`,
    ]
  )
})

test("a long sentence keeps LanguageTool's ellipsized context window", async () => {
  assert.deepEqual(
    await messagesFor(longSentence, [
      {
        message: "Possible spelling mistake found.",
        shortMessage: "Spelling mistake",
        offset: 99,
        length: 6,
        context: {
          text: "... the scheduler decides to park a worker threds before the queue drains completely and ...",
          offset: 43,
          length: 6,
        },
      },
    ]),
    [
      'Possible spelling mistake found. "threds" in "... the scheduler decides to park a worker threds before the queue drains completely and ..."',
    ]
  )
})

test("the same LanguageTool message at two spans stays two reminders", async () => {
  const text = "worker threds and gorutines"
  assert.deepEqual(
    await messagesFor(text, [
      { message: "Possible spelling mistake found.", offset: 7, length: 6 },
      { message: "Possible spelling mistake found.", offset: 18, length: 9 },
    ]),
    [
      'Possible spelling mistake found. "threds"',
      'Possible spelling mistake found. "gorutines"',
    ]
  )
})

test("the same LanguageTool message at one span collapses to one reminder", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      {
        message: "Possible spelling mistake found.",
        offset: 13,
        length: 6,
        rule: { id: "MORFOLOGIK_RULE_EN_US" },
      },
      {
        message: "Possible spelling mistake found.",
        offset: 13,
        length: 6,
        rule: { id: "HUNSPELL_RULE" },
      },
    ]),
    ['Possible spelling mistake found. "threds"']
  )
})

test("the sentence span wins over the context span", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      {
        message: "Possible spelling mistake found.",
        offset: 13,
        length: 6,
        context: { text: "wholly different gorutines", offset: 17, length: 9 },
      },
    ]),
    ['Possible spelling mistake found. "threds"']
  )
})

test("a span outside the sentence falls back to the context window", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      {
        message: "Possible spelling mistake found.",
        offset: 50,
        length: 6,
        context: { text: sentence, offset: 13, length: 6 },
      },
    ]),
    [`Possible spelling mistake found. "threds" in "${sentence}"`]
  )
})

test("an unusable offset or length leaves the message alone", async () => {
  const unusable = [
    { offset: -1, length: 6 },
    { offset: 13, length: 0 },
    { offset: 13, length: -6 },
    { offset: 13.5, length: 6 },
    { offset: 13, length: 6.5 },
    { offset: "13", length: 6 },
    { offset: 13, length: "6" },
    { offset: 15, length: 6 },
  ]

  for (const location of unusable) {
    assert.deepEqual(
      await messagesFor(sentence, [
        { message: "Possible spelling mistake found.", ...location },
      ]),
      ["Possible spelling mistake found."],
      `expected no quote for ${JSON.stringify(location)}`
    )
  }
})

test("a span that catches surrounding space is trimmed", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      { message: "Possible spelling mistake found.", offset: 12, length: 7 },
    ]),
    ['Possible spelling mistake found. "threds"']
  )
})

test("a context equal to the quoted word is not repeated", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      {
        message: "Possible spelling mistake found.",
        context: { text: "threds", offset: 0, length: 6 },
      },
    ]),
    ['Possible spelling mistake found. "threds"']
  )
})

test("LanguageTool uses the context window when offset and length are absent", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      {
        shortMessage: "Spelling mistake",
        context: { text: "worker threds", offset: 7, length: 6 },
      },
    ]),
    ['Spelling mistake "threds" in "worker threds"']
  )
})

test("a LanguageTool match with no location stays the message alone", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      { message: "Possible spelling mistake found." },
    ]),
    ["Possible spelling mistake found."]
  )
})

test("message wins over shortMessage and both are trimmed", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      {
        message: "  Possible spelling mistake found.  ",
        shortMessage: "Spelling mistake",
        offset: 13,
        length: 6,
      },
      {
        message: "   ",
        shortMessage: "  Capitalization  ",
        offset: 0,
        length: 5,
      },
    ]),
    ['Possible spelling mistake found. "threds"', 'Capitalization "using"']
  )
})

test("a match with no message of either kind is dropped", async () => {
  assert.deepEqual(
    await messagesFor(sentence, [
      { offset: 13, length: 6 },
      { message: "   ", shortMessage: "  ", offset: 13, length: 6 },
      { message: "Possible spelling mistake found.", offset: 13, length: 6 },
    ]),
    ['Possible spelling mistake found. "threds"']
  )
})

test("the highlight lands on the word inside the quoted context", async () => {
  assert.deepEqual(
    await matchesFor(fullSentence, [
      {
        message: "Possible spelling mistake found.",
        offset: 13,
        length: 6,
        context: { text: fullSentence, offset: 13, length: 6 },
      },
    ]),
    [
      {
        message: `Possible spelling mistake found. "threds" in "${fullSentence}"`,
        highlight: { offset: 59, length: 6 },
        quote: {
          ...thredsQuote,
          context: fullSentence,
          highlight: { offset: 13, length: 6 },
        },
      },
    ]
  )
})

test("the highlight skips the quoted word and marks the one in the context", async () => {
  assert.equal(
    await highlightedWordIn(fullSentence, {
      message: "Possible spelling mistake found.",
      offset: 24,
      length: 9,
      context: { text: fullSentence, offset: 24, length: 9 },
    }),
    "gorutines"
  )
})

test("a repeated word is highlighted at the reported offset, not the first one", async () => {
  const text = "the cat sat on the mat"
  const [result] = await matchesFor(text, [
    {
      message: "Possible spelling mistake found.",
      offset: 15,
      length: 3,
      context: { text, offset: 15, length: 3 },
    },
  ])

  assert.equal(
    result.message,
    'Possible spelling mistake found. "the" in "the cat sat on the mat"'
  )
  assert.equal(result.highlight?.offset, 58)
})

test("an ellipsized context highlights the word inside the window", async () => {
  assert.equal(
    await highlightedWordIn(longSentence, {
      message: "Possible spelling mistake found.",
      offset: 99,
      length: 6,
      context: {
        text: "... the scheduler decides to park a worker threds before the queue drains completely and ...",
        offset: 43,
        length: 6,
      },
    }),
    "threds"
  )
})

test("a word with no context is highlighted inside its quotes", async () => {
  assert.deepEqual(
    await matchesFor(sentence, [
      { message: "Possible spelling mistake found.", offset: 13, length: 6 },
    ]),
    [
      {
        message: 'Possible spelling mistake found. "threds"',
        highlight: { offset: 34, length: 6 },
        quote: thredsQuote,
      },
    ]
  )
})

test("the quote carries the parts the UI renders as separate lines", async () => {
  const [result] = await matchesFor(longSentence, [
    {
      message: "Possible spelling mistake found.",
      offset: 99,
      length: 6,
      context: {
        text: "... the scheduler decides to park a worker threds before the queue drains completely and ...",
        offset: 43,
        length: 6,
      },
    },
  ])

  assert.deepEqual(result.quote, {
    base: spellingBase,
    word: "threds",
    context:
      "... the scheduler decides to park a worker threds before the queue drains completely and ...",
    highlight: { offset: 43, length: 6 },
  })
})

test("the quote highlight marks the reported occurrence of a repeated word", async () => {
  const text = "the cat sat on the mat"
  const [result] = await matchesFor(text, [
    {
      message: "Possible spelling mistake found.",
      offset: 15,
      length: 3,
      context: { text, offset: 15, length: 3 },
    },
  ])

  assert.deepEqual(result.quote?.highlight, { offset: 15, length: 3 })
})

test("a match with no location carries no quote", async () => {
  const [result] = await matchesFor(sentence, [
    { message: "Possible spelling mistake found." },
  ])

  assert.equal(result.quote, undefined)
})

test("a match with no location carries no highlight", async () => {
  assert.deepEqual(
    await matchesFor(sentence, [
      { message: "Possible spelling mistake found." },
    ]),
    [{ message: "Possible spelling mistake found." }]
  )
})

test("every replacement LanguageTool offers is carried through in order", async () => {
  assert.deepEqual(
    await matchesFor(sentence, [
      {
        message: "Possible spelling mistake found.",
        offset: 13,
        length: 6,
        replacements: [
          { value: "threads" },
          { value: "shreds" },
          { value: "threes" },
          { value: "Threads" },
        ],
      },
    ]),
    [
      {
        message: 'Possible spelling mistake found. "threds"',
        highlight: { offset: 34, length: 6 },
        quote: thredsQuote,
        replacements: ["threads", "shreds", "threes", "Threads"],
      },
    ]
  )
})

test("blank and repeated replacements are dropped", async () => {
  const [result] = await matchesFor(sentence, [
    {
      message: "Possible spelling mistake found.",
      offset: 13,
      length: 6,
      replacements: [
        { value: "  threads  " },
        { value: "threads" },
        { value: "   " },
        { value: 42 },
        {},
        "shreds",
        { value: "shreds" },
      ],
    },
  ])

  assert.deepEqual(result.replacements, ["threads", "shreds"])
})

test("a match with no usable replacements carries none", async () => {
  for (const replacements of [undefined, [], [{ value: " " }], "threads"]) {
    const [result] = await matchesFor(sentence, [
      {
        message: "Possible spelling mistake found.",
        offset: 13,
        length: 6,
        replacements,
      },
    ])

    assert.deepEqual(
      result,
      {
        message: 'Possible spelling mistake found. "threds"',
        highlight: { offset: 34, length: 6 },
        quote: thredsQuote,
      },
      `expected no replacements for ${JSON.stringify(replacements)}`
    )
  }
})

test("no matches is no reminders", async () => {
  assert.deepEqual(await messagesFor(sentence, []), [])

  await withFetch(
    async () => jsonResponse({ software: { name: "LanguageTool" } }),
    async () => {
      assert.deepEqual(await checkGrammar(sentence), [])
    }
  )
})
