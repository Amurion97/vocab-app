import assert from "node:assert"
import { describe, it } from "node:test"

import {
  decideNudge,
  nudgeLink,
  practisedInWindow,
  practisedToday,
  renderNudge,
  type DecideNudgeDeps,
  type NudgeWord,
} from "@/lib/nudge"

/**
 * Build a UTC Date from a VN-local clock time.
 * Asia/Ho_Chi_Minh is UTC+7 with no DST, so we subtract 7 hours from the
 * naive UTC value of the same calendar clock.
 */
function vn(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute))
}

const sampleWord: NudgeWord = {
  id: "word-1",
  english: "ubiquitous",
  vietnamese: "có ở khắp nơi",
}

function makeDeps(overrides: Partial<DecideNudgeDeps> = {}): {
  deps: DecideNudgeDeps
  sent: {
    to: string
    from: string
    subject: string
    html: string
    text: string
  }[]
} {
  const sent: {
    to: string
    from: string
    subject: string
    html: string
    text: string
  }[] = []
  const deps: DecideNudgeDeps = {
    now: vn(2026, 11, 7, 20, 0),
    findLastReviewedAt: async () => null,
    pickWord: async () => sampleWord,
    send: async (message) => {
      sent.push(message)
    },
    baseUrl: "https://example.com",
    to: "student@example.com",
    from: "nudge@example.com",
    ...overrides,
  }
  return { deps, sent }
}

describe("practisedInWindow", () => {
  const now = vn(2026, 11, 7, 20, 0)

  it("returns false when there is no last review", () => {
    assert.strictEqual(practisedInWindow({ lastReviewedAt: null, now }), false)
  })

  it("returns true when the last review is exactly 06:00", () => {
    assert.strictEqual(
      practisedInWindow({ lastReviewedAt: vn(2026, 11, 7, 6, 0), now }),
      true
    )
  })

  it("returns false when the last review is 05:59, just before the window", () => {
    assert.strictEqual(
      practisedInWindow({ lastReviewedAt: vn(2026, 11, 7, 5, 59), now }),
      false
    )
  })

  it("returns true when the last review is 19:59, just before the window closes", () => {
    assert.strictEqual(
      practisedInWindow({ lastReviewedAt: vn(2026, 11, 7, 19, 59), now }),
      true
    )
  })

  it("returns false when the last review is exactly 20:00", () => {
    assert.strictEqual(
      practisedInWindow({ lastReviewedAt: vn(2026, 11, 7, 20, 0), now }),
      false
    )
  })

  it("returns true for a morning review even though it is before the UTC midnight", () => {
    // 07:00 VN is 00:00 UTC the same day. A naive UTC day-boundary check
    // would treat this as the start of a new UTC day; the VN-local check
    // correctly sees it as this morning's practice.
    assert.strictEqual(
      practisedInWindow({ lastReviewedAt: vn(2026, 11, 7, 7, 0), now }),
      true
    )
  })

  it("returns false when the review is on a different VN day vs. 8pm when email sent", () => {
    assert.strictEqual(
      practisedInWindow({ lastReviewedAt: vn(2026, 11, 6, 10, 0), now }),
      false
    )
  })

  it("counts a 10:00 review when now is 02:00 the next calendar date, before the next day starts", () => {
    assert.strictEqual(
      practisedInWindow({
        lastReviewedAt: vn(2026, 11, 7, 10, 0),
        now: vn(2026, 11, 8, 2, 0),
      }),
      true
    )
  })
})

describe("practisedToday", () => {
  const now = vn(2026, 11, 7, 23, 0)

  it("returns true for a review at 20:10 even though that is outside the window", () => {
    assert.strictEqual(
      practisedToday({ lastReviewedAt: vn(2026, 11, 7, 20, 10), now }),
      true
    )
  })

  it("returns false for a review just before midnight VN", () => {
    assert.strictEqual(
      practisedToday({ lastReviewedAt: vn(2026, 11, 6, 23, 59), now }),
      false
    )
  })

  it("returns false for a review at midnight, before the day starts at 06:00", () => {
    assert.strictEqual(
      practisedToday({ lastReviewedAt: vn(2026, 11, 7, 0, 0), now }),
      false
    )
  })

  it("returns true for a review at 06:00, when the day starts", () => {
    assert.strictEqual(
      practisedToday({ lastReviewedAt: vn(2026, 11, 7, 6, 0), now }),
      true
    )
  })

  it("returns false when the review is after the link is opened", () => {
    assert.strictEqual(
      practisedToday({ lastReviewedAt: vn(2026, 11, 7, 23, 30), now }),
      false
    )
  })

  it("returns true when the link is opened at 02:00, still inside the day that started at 06:00", () => {
    assert.strictEqual(
      practisedToday({
        lastReviewedAt: vn(2026, 11, 7, 21, 0),
        now: vn(2026, 11, 8, 2, 0),
      }),
      true
    )
  })
})

describe("renderNudge", () => {
  it("puts the English word in the subject and omits Vietnamese", () => {
    const { subject, html, text } = renderNudge({
      word: sampleWord,
      link: "https://example.com/review?word=word-1",
    })

    assert.strictEqual(subject, "Review: ubiquitous")
    assert.ok(!subject.includes(sampleWord.vietnamese))
    assert.ok(!html.includes(sampleWord.vietnamese))
    assert.ok(!text.includes(sampleWord.vietnamese))
    assert.ok(html.includes("Review ubiquitous"))
    assert.ok(text.includes("https://example.com/review?word=word-1"))
  })

  it("mentions the practice window in the body", () => {
    const { html, text } = renderNudge({
      word: sampleWord,
      link: "https://example.com/review?word=word-1",
    })

    assert.ok(html.includes("between 6am and 8pm today"))
    assert.ok(text.includes("between 6am and 8pm today"))
  })
})

describe("nudgeLink", () => {
  it("appends ?word=<id> without a trailing slash on the base URL", () => {
    assert.strictEqual(
      nudgeLink({ wordId: "abc", baseUrl: "https://example.com" }),
      "https://example.com/review?word=abc"
    )
  })

  it("strips an existing trailing slash", () => {
    assert.strictEqual(
      nudgeLink({ wordId: "abc", baseUrl: "https://example.com/" }),
      "https://example.com/review?word=abc"
    )
  })
})

describe("decideNudge", () => {
  it("suppresses when a review happened inside the window", async () => {
    const { deps, sent } = makeDeps({
      findLastReviewedAt: async () => vn(2026, 11, 7, 10, 0),
    })

    const result = await decideNudge(deps)

    assert.deepStrictEqual(result, { sent: false, reason: "practised" })
    assert.strictEqual(sent.length, 0)
  })

  it("suppresses when there are no words", async () => {
    const { deps, sent } = makeDeps({
      pickWord: async () => null,
    })

    const result = await decideNudge(deps)

    assert.deepStrictEqual(result, { sent: false, reason: "no-words" })
    assert.strictEqual(sent.length, 0)
  })

  it("sends the rendered nudge when the window is empty", async () => {
    const { deps, sent } = makeDeps({
      findLastReviewedAt: async () => vn(2026, 11, 7, 5, 0),
    })

    const result = await decideNudge(deps)

    assert.strictEqual(result.sent, true)
    assert.strictEqual(result.wordId, sampleWord.id)
    assert.strictEqual(result.subject, "Review: ubiquitous")
    assert.strictEqual(sent.length, 1)
    assert.strictEqual(sent[0].to, deps.to)
    assert.strictEqual(sent[0].from, deps.from)
    assert.strictEqual(sent[0].subject, "Review: ubiquitous")
    assert.ok(sent[0].html.includes("ubiquitous"))
    assert.ok(sent[0].text.includes("/review?word=word-1"))
  })

  it("sends when a review happened at 20:10, outside the window but on the same day", async () => {
    const { deps, sent } = makeDeps({
      findLastReviewedAt: async () => vn(2026, 11, 7, 20, 10),
    })

    const result = await decideNudge(deps)

    assert.strictEqual(result.sent, true)
    assert.strictEqual(sent.length, 1)
  })
})
