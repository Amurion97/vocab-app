import assert from "node:assert/strict"
import test from "node:test"

import { checkGroq } from "../lib/clients/groq-grammar"

const sentence = "He go to school"

function testClient(mockClient: unknown) {
  return {
    apiKey: "test-key",
    client: mockClient as never,
  }
}

test("a missing Groq key throws before the request", async () => {
  const previous = process.env.GROQ_API_KEY
  delete process.env.GROQ_API_KEY
  try {
    await assert.rejects(checkGroq(sentence), {
      message: "Groq is unavailable.",
    })
    await assert.rejects(
      checkGroq(sentence, { client: { chat: {} } as never }),
      {
        message: "Groq is unavailable.",
      }
    )
  } finally {
    if (previous !== undefined) {
      process.env.GROQ_API_KEY = previous
    }
  }
})

test("an empty or whitespace-only sentence returns empty array", async () => {
  const previous = process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY = "test-groq-key"
  try {
    const result = await checkGroq("   ")
    assert.deepEqual(result, [])
  } finally {
    if (previous === undefined) {
      delete process.env.GROQ_API_KEY
    } else {
      process.env.GROQ_API_KEY = previous
    }
  }
})

test("an API error throws Groq is unavailable", async () => {
  const mockClient = {
    chat: {
      completions: {
        create: async () => {
          throw new Error("Rate limit exceeded")
        },
      },
    },
  }

  await assert.rejects(checkGroq(sentence, testClient(mockClient)), {
    message: "Groq is unavailable.",
  })
})

test("invalid JSON in completion returns empty array", async () => {
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: "not valid json" } }],
        }),
      },
    },
  }

  const result = await checkGroq(sentence, testClient(mockClient))
  assert.deepEqual(result, [])
})

test("empty edits array returns empty matches", async () => {
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({ edits: [] }) } }],
        }),
      },
    },
  }

  const result = await checkGroq(sentence, testClient(mockClient))
  assert.deepEqual(result, [])
})

test("edits are parsed into structured GrammarSuggestion with quote, highlight, and replacements", async () => {
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  edits: [
                    {
                      original: "go",
                      replacement: "goes",
                      description: "Subject-verb agreement.",
                      context: "He go to school",
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  }

  const result = await checkGroq(sentence, testClient(mockClient))
  assert.equal(result.length, 1)
  assert.deepEqual(result[0], {
    message: "Subject-verb agreement. go → goes",
    replacements: ["goes"],
    highlight: {
      offset: 24,
      length: 2,
    },
    quote: {
      base: "Subject-verb agreement.",
      word: "go",
      context: "He go to school",
      highlight: {
        offset: 3,
        length: 2,
      },
    },
  })
})

test("resolves sentence-relative start offset when clause context is also provided", async () => {
  const repeatedSentence = "He stays at home but I stays at school"
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  edits: [
                    {
                      original: "stays",
                      replacement: "stay",
                      description: "Subject-verb agreement.",
                      context: "but I stays at school",
                      start: 23,
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  }

  const result = await checkGroq(repeatedSentence, {
    apiKey: "test-key",
    client: mockClient as never,
  })
  assert.equal(result.length, 1)
  assert.equal(result[0]?.quote?.word, "stays")
  assert.equal(result[0]?.quote?.context, "but I stays at school")
  assert.deepEqual(result[0]?.quote?.highlight, { offset: 6, length: 5 })
  assert.equal(result[0]?.quote?.context?.slice(6, 11), "stays")
})

test("unquoted and wrapped keys in environment are handled", async () => {
  const previous = process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY = '"test-key"'
  let called = false
  const mockClient = {
    chat: {
      completions: {
        create: async () => {
          called = true
          return {
            choices: [{ message: { content: JSON.stringify({ edits: [] }) } }],
          }
        },
      },
    },
  }

  try {
    const result = await checkGroq(sentence, { client: mockClient as never })
    assert.deepEqual(result, [])
    assert.equal(called, true)
  } finally {
    if (previous === undefined) {
      delete process.env.GROQ_API_KEY
    } else {
      process.env.GROQ_API_KEY = previous
    }
  }
})

test("a repeated word where 1st is correct and 2nd is wrong resolves via clause context", async () => {
  const repeatedSentence = "He stays at home but I stays at school"
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  edits: [
                    {
                      original: "stays",
                      replacement: "stay",
                      description: "Subject-verb agreement.",
                      context: "but I stays at school",
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  }

  const result = await checkGroq(repeatedSentence, testClient(mockClient))
  assert.equal(result.length, 1)
  assert.equal(result[0]?.quote?.word, "stays")
  assert.equal(result[0]?.quote?.context, "but I stays at school")
  assert.deepEqual(result[0]?.quote?.highlight, { offset: 6, length: 5 })
  assert.equal(result[0]?.quote?.context?.slice(6, 11), "stays")
})

test("a repeated word where 1st is correct and 2nd is wrong resolves via start offset", async () => {
  const repeatedSentence = "He stays at home but I stays at school"
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  edits: [
                    {
                      original: "stays",
                      replacement: "stay",
                      description: "Subject-verb agreement.",
                      start: 23,
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  }

  const result = await checkGroq(repeatedSentence, testClient(mockClient))
  assert.equal(result.length, 1)
  assert.equal(result[0]?.quote?.word, "stays")
  assert.deepEqual(result[0]?.quote?.highlight, { offset: 23, length: 5 })
  assert.equal(result[0]?.quote?.context?.slice(23, 28), "stays")
})

test("two identical errors of the same word in a sentence highlight distinct occurrences", async () => {
  const repeatedSentence = "I stays at home and you stays at school"
  const mockClient = {
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  edits: [
                    {
                      original: "stays",
                      replacement: "stay",
                      description: "Subject-verb agreement 1.",
                    },
                    {
                      original: "stays",
                      replacement: "stay",
                      description: "Subject-verb agreement 2.",
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  }

  const result = await checkGroq(repeatedSentence, testClient(mockClient))
  assert.equal(result.length, 2)
  assert.deepEqual(result[0]?.quote?.highlight, { offset: 2, length: 5 })
  assert.equal(result[0]?.quote?.context?.slice(2, 7), "stays")

  assert.deepEqual(result[1]?.quote?.highlight, { offset: 24, length: 5 })
  assert.equal(result[1]?.quote?.context?.slice(24, 29), "stays")
})
