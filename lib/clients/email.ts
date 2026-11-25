export type NudgeEmail = {
  to: string
  from: string
  subject: string
  html: string
  text: string
}

export type NudgeSender = (email: NudgeEmail) => Promise<void>

function resendApiKey(): string | undefined {
  // Next can leave one unmatched quote on the env value.
  const raw = process.env.RESEND_API_KEY?.trim()
  if (!raw) {
    return undefined
  }
  const wrapped =
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  const unquoted = wrapped ? raw.slice(1, -1) : raw.replace(/^["']/, "")
  return unquoted.trim() || undefined
}

export function resendSender(): NudgeSender {
  const key = resendApiKey()
  if (!key) {
    throw new Error("RESEND_API_KEY is required for the Resend sender.")
  }

  return async (email) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: email.from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new Error(
        `Resend returned ${response.status}: ${body || response.statusText}`
      )
    }
  }
}

export function consoleSender(): NudgeSender {
  return async (email) => {
    console.log("[Nudge] To:", email.to)
    console.log("[Nudge] From:", email.from)
    console.log("[Nudge] Subject:", email.subject)
    console.log("[Nudge] Text:")
    console.log(email.text)
    console.log("[Nudge] HTML length:", email.html.length)
  }
}

export function nudgeSender(): NudgeSender {
  if (resendApiKey()) {
    return resendSender()
  }
  return consoleSender()
}
