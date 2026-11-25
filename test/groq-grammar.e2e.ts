import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { checkGroq } from "@/lib/clients/groq-grammar"
import type { GrammarMatch } from "@/lib/clients/languagetool"

const apiKey = process.env.GROQ_API_KEY?.trim()
const delayMs = Number(process.env.GROQ_E2E_DELAY_MS ?? "0")

function shouldRunGroup(name: string): boolean {
  if (!apiKey) return false
  const filter = process.env.GROQ_E2E_GROUP?.trim()
  if (!filter) return true
  const groups = filter.split(",").map((s) => s.trim().toLowerCase())
  return groups.includes(name.toLowerCase())
}

async function runCheck(sentence: string): Promise<GrammarMatch[]> {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  const results = await checkGroq(sentence)
  assertHighlightInvariants(results)
  return results
}

function assertHighlightInvariants(matches: GrammarMatch[]) {
  for (const match of matches) {
    if (match.quote?.highlight && match.quote?.context) {
      const { offset, length } = match.quote.highlight
      const extracted = match.quote.context.slice(offset, offset + length)
      assert.equal(
        extracted.toLowerCase(),
        match.quote.word.toLowerCase(),
        `Highlight slice "${extracted}" must match word "${match.quote.word}" in context "${match.quote.context}"`
      )
    }
  }
}

function findSuggestionFor(matches: GrammarMatch[], targetSubstr: string) {
  const target = targetSubstr.toLowerCase()
  return matches.find((m) => {
    const word = m.quote?.word?.toLowerCase() ?? ""
    const msg = m.message.toLowerCase()
    return (
      word.includes(target) || target.includes(word) || msg.includes(target)
    )
  })
}

function hasReplacement(
  match: GrammarMatch | undefined,
  expected: string
): boolean {
  if (!match?.replacements || match.replacements.length === 0) return false
  const target = expected.toLowerCase()
  return match.replacements.some((r) => r.toLowerCase().includes(target))
}

// ---------------------------------------------------------------------------
// Group 1: agreement (4 tests)
// ---------------------------------------------------------------------------
describe(
  "agreement",
  { skip: !shouldRunGroup("agreement"), concurrency: 1 },
  () => {
    it("flags subject-verb agreement error", async () => {
      const matches = await runCheck("He go to school every day.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "go")
      assert.ok(match, "Expected suggestion targeting 'go'")
      assert.ok(
        hasReplacement(match, "goes"),
        "Expected replacement to include 'goes'"
      )
    })

    it("flags negative agreement error", async () => {
      const matches = await runCheck("She don't like coffee.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "don't")
      assert.ok(match, "Expected suggestion targeting 'don't'")
      assert.ok(
        hasReplacement(match, "doesn't"),
        "Expected replacement to include 'doesn't'"
      )
    })

    it("flags plural subject with singular verb", async () => {
      const matches = await runCheck("The books is on the table.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "is")
      assert.ok(match, "Expected suggestion targeting 'is'")
      assert.ok(
        hasReplacement(match, "are"),
        "Expected replacement to include 'are'"
      )
    })

    it("flags irregular past tense verb error", async () => {
      const matches = await runCheck("Yesterday she swimmed in the ocean.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "swimmed")
      assert.ok(match, "Expected suggestion targeting 'swimmed'")
      assert.ok(
        hasReplacement(match, "swam"),
        "Expected replacement to include 'swam'"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// Group 2: articles-and-nouns (5 tests)
// ---------------------------------------------------------------------------
describe(
  "articles-and-nouns",
  { skip: !shouldRunGroup("articles-and-nouns"), concurrency: 1 },
  () => {
    it("flags wrong indefinite article before vowel sound", async () => {
      const matches = await runCheck("She ate a apple for breakfast.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "a")
      assert.ok(match, "Expected suggestion targeting 'a'")
      assert.ok(
        hasReplacement(match, "an"),
        "Expected replacement to include 'an'"
      )
    })

    it("flags indefinite article with plural noun", async () => {
      const matches = await runCheck("I have a books on my desk.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "books") ?? findSuggestionFor(matches, "a")
      assert.ok(match, "Expected suggestion targeting 'a books'")
      assert.ok(
        hasReplacement(match, "a book") || hasReplacement(match, "books"),
        "Expected replacement to suggest 'a book' or 'books'"
      )
    })

    it("flags missing article with superlative", async () => {
      const matches = await runCheck("She is best student in the class.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "best")
      assert.ok(match, "Expected suggestion targeting superlative 'best'")
      assert.ok(
        hasReplacement(match, "the best"),
        "Expected replacement to include 'the best'"
      )
    })

    it("flags pluralized uncountable noun: advices", async () => {
      const matches = await runCheck("She gave me many advices.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "advices")
      assert.ok(match, "Expected suggestion targeting 'advices'")
      assert.ok(
        hasReplacement(match, "advice"),
        "Expected replacement to suggest 'advice'"
      )
    })

    it("flags pluralized uncountable noun: informations", async () => {
      const matches = await runCheck("I need some informations about the trip.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "informations")
      assert.ok(match, "Expected suggestion targeting 'informations'")
      assert.ok(
        hasReplacement(match, "information"),
        "Expected replacement to suggest 'information'"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// Group 3: prepositions-and-collocations (5 tests)
// ---------------------------------------------------------------------------
describe(
  "prepositions-and-collocations",
  { skip: !shouldRunGroup("prepositions-and-collocations"), concurrency: 1 },
  () => {
    it("flags incorrect dependent preposition: depends of", async () => {
      const matches = await runCheck("She depends of her brother for advice.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "depends") ??
        findSuggestionFor(matches, "of")
      assert.ok(match, "Expected suggestion targeting 'depends of'")
      assert.ok(
        hasReplacement(match, "on"),
        "Expected replacement to suggest preposition 'on'"
      )
    })

    it("flags marriage preposition collocation: married with", async () => {
      const matches = await runCheck("He is married with her.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "married") ??
        findSuggestionFor(matches, "with")
      assert.ok(match, "Expected suggestion targeting 'married with'")
      assert.ok(
        hasReplacement(match, "to"),
        "Expected replacement to suggest preposition 'to'"
      )
    })

    it("flags unnatural verb-noun collocation: did a mistake", async () => {
      const matches = await runCheck("He did a big mistake on the exam.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "did") ??
        findSuggestionFor(matches, "mistake")
      assert.ok(match, "Expected suggestion targeting 'did'")
      assert.ok(
        hasReplacement(match, "made"),
        "Expected replacement to suggest 'made'"
      )
    })

    it("flags gerund after prepositional phrase: look forward to see", async () => {
      const matches = await runCheck("I look forward to see you next week.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "see")
      assert.ok(match, "Expected suggestion targeting 'to see'")
      assert.ok(
        hasReplacement(match, "seeing"),
        "Expected replacement to suggest 'seeing'"
      )
    })

    it("flags redundant preposition: despite of", async () => {
      const matches = await runCheck("Despite of the rain we went outside.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "despite") ??
        findSuggestionFor(matches, "of")
      assert.ok(match, "Expected suggestion targeting 'Despite of'")
      assert.ok(
        hasReplacement(match, "despite") ||
          hasReplacement(match, "in spite of"),
        "Expected replacement to suggest 'Despite' or 'In spite of'"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// Group 4: spelling-and-confused-words (5 tests)
// ---------------------------------------------------------------------------
describe(
  "spelling-and-confused-words",
  { skip: !shouldRunGroup("spelling-and-confused-words"), concurrency: 1 },
  () => {
    it("flags spelling error: recieve", async () => {
      const matches = await runCheck("I will recieve the package tomorrow.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "recieve")
      assert.ok(match, "Expected suggestion targeting 'recieve'")
      assert.ok(
        hasReplacement(match, "receive"),
        "Expected replacement to suggest 'receive'"
      )
    })

    it("flags typo: definately", async () => {
      const matches = await runCheck("This is definately a good idea.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "definately")
      assert.ok(match, "Expected suggestion targeting 'definately'")
      assert.ok(
        hasReplacement(match, "definitely"),
        "Expected replacement to suggest 'definitely'"
      )
    })

    it("flags time preposition confusion: since with duration", async () => {
      const matches = await runCheck(
        "I have been living here since three years."
      )
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "since")
      assert.ok(match, "Expected suggestion targeting 'since'")
      assert.ok(
        hasReplacement(match, "for"),
        "Expected replacement to suggest 'for'"
      )
    })

    it("flags countable quantifier: less before plural", async () => {
      const matches = await runCheck("I have less friends than you.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "less")
      assert.ok(match, "Expected suggestion targeting 'less'")
      assert.ok(
        hasReplacement(match, "fewer"),
        "Expected replacement to suggest 'fewer'"
      )
    })

    it("flags homophone contraction vs possessive: it's tail", async () => {
      const matches = await runCheck("The dog wagged it's tail.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match = findSuggestionFor(matches, "it's")
      assert.ok(match, 'Expected suggestion targeting "it\'s"')
      assert.ok(
        hasReplacement(match, "its"),
        "Expected replacement to suggest 'its'"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// Group 5: syntax-and-punctuation (4 tests)
// ---------------------------------------------------------------------------
describe(
  "syntax-and-punctuation",
  { skip: !shouldRunGroup("syntax-and-punctuation"), concurrency: 1 },
  () => {
    it("flags question word order: Where you are going", async () => {
      const matches = await runCheck("Where you are going?")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "you are") ??
        findSuggestionFor(matches, "where")
      assert.ok(match, "Expected suggestion targeting question inversion")
      assert.ok(
        hasReplacement(match, "are you"),
        "Expected replacement to suggest 'are you'"
      )
    })

    it("flags unnatural adverb placement", async () => {
      const matches = await runCheck("I like very much this book.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const match =
        findSuggestionFor(matches, "very much") ??
        findSuggestionFor(matches, "like")
      assert.ok(match, "Expected suggestion targeting awkward adverb placement")
    })

    it("flags subject pronoun case: Me and him went", async () => {
      const matches = await runCheck("Me and him went to the store.")
      assert.ok(matches.length > 0, "Expected at least one grammar suggestion")
      const matchMe = findSuggestionFor(matches, "me")
      const matchHim = findSuggestionFor(matches, "him")
      assert.ok(
        matchMe || matchHim,
        "Expected suggestion targeting object pronoun as subject"
      )
      const hasSubjectFix =
        hasReplacement(matchMe, "i") ||
        hasReplacement(matchHim, "he") ||
        hasReplacement(matches[0], "he and i") ||
        hasReplacement(matches[0], "we")
      assert.ok(
        hasSubjectFix,
        "Expected replacement to suggest subject pronouns (I, he, we)"
      )
    })

    it("flags comma splice", async () => {
      const matches = await runCheck("I was tired, I went to bed early.")
      assert.ok(
        matches.length > 0,
        "Expected at least one suggestion for comma splice"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// Group 6: structure-and-edge-cases (5 tests)
// ---------------------------------------------------------------------------
describe(
  "structure-and-edge-cases",
  { skip: !shouldRunGroup("structure-and-edge-cases"), concurrency: 1 },
  () => {
    it("flags multiple distinct errors in a single sentence", async () => {
      const matches = await runCheck(
        "Yesterday he go to school and doed his homework."
      )
      assert.ok(
        matches.length >= 2,
        "Expected at least two distinct suggestions"
      )
      const matchGo = findSuggestionFor(matches, "go")
      const matchDoed = findSuggestionFor(matches, "doed")
      assert.ok(matchGo, "Expected suggestion for 'go'")
      assert.ok(matchDoed, "Expected suggestion for 'doed'")
    })

    it("disambiguates repeated words when 1st is right and 2nd is wrong", async () => {
      const matches = await runCheck("He stays at home but I stays at school.")
      assert.ok(matches.length > 0, "Expected at least one suggestion")
      const match = findSuggestionFor(matches, "stays")
      assert.ok(match, "Expected suggestion targeting 'stays'")
      assert.ok(
        match.quote?.context?.includes("I stays") ||
          match.quote?.context?.includes("but I"),
        `Expected quote context to isolate erroneous clause 'I stays', got '${match.quote?.context}'`
      )
    })

    it("processes multi-sentence input cleanly", async () => {
      const matches = await runCheck(
        "I bought a book. He read it yesterday and enjoy it."
      )
      assert.ok(matches.length > 0, "Expected suggestion for 'enjoy'")
      const match = findSuggestionFor(matches, "enjoy")
      assert.ok(match, "Expected suggestion targeting 'enjoy'")
      assert.ok(
        hasReplacement(match, "enjoyed"),
        "Expected replacement to suggest past tense 'enjoyed'"
      )
    })

    it("handles embedded quotes without JSON corruption", async () => {
      const matches = await runCheck('He said, "I is ready" to his friend.')
      assert.ok(
        matches.length > 0,
        "Expected suggestion inside quoted dialogue"
      )
      const match = findSuggestionFor(matches, "is")
      assert.ok(match, "Expected suggestion targeting 'is'")
      assert.ok(
        hasReplacement(match, "am"),
        "Expected replacement to suggest 'am'"
      )
    })

    it("flags error in minimal two-word sentence", async () => {
      const matches = await runCheck("I runs.")
      assert.ok(matches.length > 0, "Expected suggestion for 'I runs'")
      const match = findSuggestionFor(matches, "runs")
      assert.ok(match, "Expected suggestion targeting 'runs'")
      assert.ok(
        hasReplacement(match, "run"),
        "Expected replacement to suggest 'run'"
      )
    })
  }
)

// ---------------------------------------------------------------------------
// Group 7: clean-sentences (2 tests)
// ---------------------------------------------------------------------------
describe(
  "clean-sentences",
  { skip: !shouldRunGroup("clean-sentences"), concurrency: 1 },
  () => {
    it("returns no suggestions for complex multi-clause sentence", async () => {
      const matches = await runCheck(
        "Although it was raining heavily, we decided to continue our journey across the mountains."
      )
      assert.equal(
        matches.length,
        0,
        "Expected zero suggestions on clean complex sentence"
      )
    })

    it("returns no suggestions for idiomatic clean sentence", async () => {
      const matches = await runCheck(
        "She has been working here for three years without any issues."
      )
      assert.equal(
        matches.length,
        0,
        "Expected zero suggestions on clean idiomatic sentence"
      )
    })
  }
)
