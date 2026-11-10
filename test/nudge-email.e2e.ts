import assert from "node:assert"
import { describe, it } from "node:test"

import { resendSender } from "@/lib/email"
import { renderNudge, nudgeLink } from "@/lib/nudge"

const apiKey = process.env.RESEND_API_KEY?.trim()
const to = process.env.NUDGE_TO_EMAIL?.trim()
const from = process.env.NUDGE_FROM_EMAIL?.trim()

describe("nudge email e2e", { skip: !apiKey }, () => {
  it("sends one real nudge through Resend", async () => {
    if (!to) {
      throw new Error("NUDGE_TO_EMAIL is required for the e2e email test.")
    }
    if (!from) {
      throw new Error("NUDGE_FROM_EMAIL is required for the e2e email test.")
    }

    const word = {
      id: "e2e-word",
      english: "ubiquitous",
      vietnamese: "có ở khắp nơi",
    }
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const link = nudgeLink({ wordId: word.id, baseUrl })
    const { subject, html, text } = renderNudge({ word, link })

    await resendSender()({
      to,
      from,
      subject,
      html,
      text,
    })

    assert.ok(true)
  })
})
