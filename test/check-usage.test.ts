import assert from "node:assert/strict"
import test from "node:test"

import type { UsageCheck } from "../lib/gemini-usage"
import { parseIssues } from "../lib/issues"
import { handleUsageCheck, type UsageCheckDeps } from "../lib/usage-check"

const passedMeaning: UsageCheck = {
  wordPresent: true,
  usedCorrectly: true,
  feedback: "Used with the right meaning.",
  suggestion: null,
}

function standIns(): UsageCheckDeps {
  return {
    checkMeaning: async () => {
      throw new Error("Meaning check should not run")
    },
    checkLanguageTool: async () => {
      throw new Error("LanguageTool should not run")
    },
    checkSapling: async () => {
      throw new Error("Sapling should not run")
    },
    findWord: async () => {
      throw new Error("Word lookup should not run")
    },
    saveAttempt: async () => {
      throw new Error("Save should not run")
    },
    revalidateHome: () => {
      throw new Error("Refresh should not run")
    },
  }
}

function request(body: unknown) {
  return new Request("http://localhost/api/check-usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

test("empty checker selection is rejected before any checker runs", async () => {
  const response = await handleUsageCheck(
    request({
      english: "run",
      vietnamese: "chạy",
      sentence: "The dog run fast.",
      checkers: [],
    }),
    standIns()
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Choose LanguageTool, Sapling, or both.",
  })
})

test("an unknown checker is rejected before any checker runs", async () => {
  const response = await handleUsageCheck(
    request({
      english: "run",
      vietnamese: "chạy",
      sentence: "The dog run fast.",
      checkers: ["Harper"],
    }),
    standIns()
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Choose LanguageTool, Sapling, or both.",
  })
})

test("LanguageTool only returns that checker's warning", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => passedMeaning
  deps.checkLanguageTool = async () => [{ message: "Use makes." }]

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["LanguageTool"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    passed: true,
    wordPresent: true,
    feedback: "Used with the right meaning.",
    suggestion: null,
    issues: [
      {
        source: "grammar",
        severity: "warning",
        message: "Use makes.",
        checker: "LanguageTool",
      },
    ],
    grammarChecks: [
      {
        checker: "LanguageTool",
        available: true,
        suggestions: ["Use makes."],
      },
    ],
  })
})

test("Sapling only returns that checker's warning", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => passedMeaning
  deps.checkSapling = async () => [{ message: "make → makes" }]

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["Sapling"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    passed: true,
    wordPresent: true,
    feedback: "Used with the right meaning.",
    suggestion: null,
    issues: [
      {
        source: "grammar",
        severity: "warning",
        message: "make → makes",
        checker: "Sapling",
      },
    ],
    grammarChecks: [
      {
        checker: "Sapling",
        available: true,
        suggestions: ["make → makes"],
      },
    ],
  })
})

test("both checkers keep separate sections for the same warning", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => passedMeaning
  deps.checkLanguageTool = async () => [{ message: "Use makes." }]
  deps.checkSapling = async () => [{ message: "Use makes." }]

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["LanguageTool", "Sapling"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    passed: true,
    wordPresent: true,
    feedback: "Used with the right meaning.",
    suggestion: null,
    issues: [
      {
        source: "grammar",
        severity: "warning",
        message: "Use makes.",
        checker: "LanguageTool",
      },
      {
        source: "grammar",
        severity: "warning",
        message: "Use makes.",
        checker: "Sapling",
      },
    ],
    grammarChecks: [
      {
        checker: "LanguageTool",
        available: true,
        suggestions: ["Use makes."],
      },
      {
        checker: "Sapling",
        available: true,
        suggestions: ["Use makes."],
      },
    ],
  })
})

test("one rejected checker leaves the other checker's warning", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => passedMeaning
  deps.checkSapling = async () => [{ message: "make → makes" }]

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["LanguageTool", "Sapling"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.passed, true)
  assert.deepEqual(body.issues, [
    {
      source: "grammar",
      severity: "warning",
      message: "make → makes",
      checker: "Sapling",
    },
  ])
  assert.deepEqual(body.grammarChecks, [
    { checker: "LanguageTool", available: false, suggestions: [] },
    {
      checker: "Sapling",
      available: true,
      suggestions: ["make → makes"],
    },
  ])
})

test("a busy Meaning check returns 503", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => {
    const error = new Error("Usage check is busy. Try again in a moment.")
    error.name = "UsageCheckBusyError"
    throw error
  }

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["LanguageTool"],
    }),
    deps
  )

  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Usage check is busy. Try again in a moment.",
    reason: "busy",
  })
})

test("any other Meaning check failure returns 500", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => {
    throw new Error("grader exploded")
  }

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["Sapling"],
    }),
    deps
  )

  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "grader exploded",
  })
})

test("a grammar warning leaves a failed Meaning check failed", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => ({
    wordPresent: true,
    usedCorrectly: false,
    feedback: "Wrong sense.",
    suggestion: "She made a mistake.",
  })
  deps.checkLanguageTool = async () => [{ message: "Use makes." }]

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He make a mistake.",
      checkers: ["LanguageTool"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    passed: false,
    wordPresent: true,
    feedback: "Wrong sense.",
    suggestion: "She made a mistake.",
    issues: [
      {
        source: "meaning",
        severity: "error",
        message: "Wrong sense.",
      },
      {
        source: "grammar",
        severity: "warning",
        message: "Use makes.",
        checker: "LanguageTool",
      },
    ],
    grammarChecks: [
      {
        checker: "LanguageTool",
        available: true,
        suggestions: ["Use makes."],
      },
    ],
  })
})

test("issue reader keeps meaning issues and grammar issues with or without a checker", () => {
  assert.deepEqual(
    parseIssues([
      { source: "meaning", severity: "error", message: "Wrong sense." },
      { source: "grammar", severity: "warning", message: "Old warning." },
      {
        source: "grammar",
        severity: "warning",
        message: "Use makes.",
        checker: "LanguageTool",
      },
    ]),
    [
      { source: "meaning", severity: "error", message: "Wrong sense." },
      { source: "grammar", severity: "warning", message: "Old warning." },
      {
        source: "grammar",
        severity: "warning",
        message: "Use makes.",
        checker: "LanguageTool",
      },
    ]
  )
})

test("a selected checker with no suggestions still has a section", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => passedMeaning
  deps.checkSapling = async () => []

  const response = await handleUsageCheck(
    request({
      english: "make",
      vietnamese: "làm",
      sentence: "He makes a mistake.",
      checkers: ["Sapling"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    ok: true,
    passed: true,
    wordPresent: true,
    feedback: "Used with the right meaning.",
    suggestion: null,
    issues: [],
    grammarChecks: [{ checker: "Sapling", available: true, suggestions: [] }],
  })
})

test("a passed Meaning check keeps stored reminders when the selected checker fails", async () => {
  const deps = standIns()
  deps.checkMeaning = async () => passedMeaning
  deps.findWord = async () => ({
    id: "word-1",
    english: "make",
    vietnamese: "làm",
  })
  deps.revalidateHome = () => {}
  let savedIssueUpdate: unknown = "not-saved"
  deps.saveAttempt = async (input) => {
    savedIssueUpdate = input.issueUpdate
  }

  const response = await handleUsageCheck(
    request({
      wordId: "word-1",
      sentence: "He makes a mistake.",
      checkers: ["Sapling"],
    }),
    deps
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.passed, true)
  assert.deepEqual(body.grammarChecks, [
    { checker: "Sapling", available: false, suggestions: [] },
  ])
  assert.deepEqual(savedIssueUpdate, { kind: "preserve" })
})
