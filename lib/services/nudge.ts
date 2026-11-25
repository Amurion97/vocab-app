export const PRACTICE_TIMEZONE = "Asia/Ho_Chi_Minh"
export const WINDOW_START_HOUR = 6
export const WINDOW_END_HOUR = 20

export type NudgeWord = {
  id: string
  english: string
  vietnamese: string
}

export type DecideNudgeDeps = {
  now: Date
  findLastReviewedAt: () => Promise<Date | null>
  pickWord: () => Promise<NudgeWord | null>
  send: (message: {
    to: string
    from: string
    subject: string
    html: string
    text: string
  }) => Promise<void>
  baseUrl: string
  to: string
  from: string
}

export type DecideNudgeResult =
  | { sent: false; reason: "practised" | "no-words" }
  | { sent: true; wordId: string; subject: string }

type VnLocal = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

/**
 * Convert a UTC instant into the VN-local clock parts. This is the single
 * source of truth for all Nudge time rules.
 */
function toVnLocal(date: Date): VnLocal {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: PRACTICE_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const get = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value
    if (!value) {
      throw new Error(`Could not determine ${type} in ${PRACTICE_TIMEZONE}`)
    }
    return Number(value)
  }

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

function vnDateKey(local: Pick<VnLocal, "year" | "month" | "day">): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${local.year}-${pad(local.month)}-${pad(local.day)}`
}

/**
 * The practice day starts at 06:00 VN. An instant before 06:00 still belongs
 * to the practice day that started at 06:00 the previous calendar date.
 * The key is that start date.
 */
function practiceDayKey(local: VnLocal): string {
  if (local.hour >= WINDOW_START_HOUR) {
    return vnDateKey(local)
  }

  const previousCalendarDate = new Date(
    Date.UTC(local.year, local.month - 1, local.day)
  )
  previousCalendarDate.setUTCDate(previousCalendarDate.getUTCDate() - 1)
  return vnDateKey({
    year: previousCalendarDate.getUTCFullYear(),
    month: previousCalendarDate.getUTCMonth() + 1,
    day: previousCalendarDate.getUTCDate(),
  })
}

function onSamePracticeDay(review: VnLocal, now: VnLocal): boolean {
  return practiceDayKey(review) === practiceDayKey(now)
}

export function practisedInWindow({
  lastReviewedAt,
  now,
}: {
  lastReviewedAt: Date | null
  now: Date
}): boolean {
  if (!lastReviewedAt) {
    return false
  }

  const nowLocal = toVnLocal(now)
  const reviewLocal = toVnLocal(lastReviewedAt)

  if (!onSamePracticeDay(reviewLocal, nowLocal)) {
    return false
  }

  const minutes = reviewLocal.hour * 60 + reviewLocal.minute
  const startMinutes = WINDOW_START_HOUR * 60
  const endMinutes = WINDOW_END_HOUR * 60

  return minutes >= startMinutes && minutes < endMinutes
}

export function practisedToday({
  lastReviewedAt,
  now,
}: {
  lastReviewedAt: Date | null
  now: Date
}): boolean {
  if (!lastReviewedAt || lastReviewedAt.getTime() > now.getTime()) {
    return false
  }

  return onSamePracticeDay(toVnLocal(lastReviewedAt), toVnLocal(now))
}

export function nudgeLink({
  wordId,
  baseUrl,
}: {
  wordId: string
  baseUrl: string
}): string {
  const normalized = baseUrl.replace(/\/$/, "")
  return `${normalized}/review?word=${wordId}`
}

export function renderNudge({
  word,
  link,
}: {
  word: NudgeWord
  link: string
}): { subject: string; html: string; text: string } {
  const subject = `Review: ${word.english}`
  const bodyText = `Time to practise ${word.english}.`
  const windowText = "You didn't practise between 6am and 8pm today."

  const html = `
<!doctype html>
<html lang="en">
  <body>
    <p>${bodyText}</p>
    <p>${windowText}</p>
    <p>
      <a href="${link}">Review ${word.english}</a>
    </p>
  </body>
</html>
  `.trim()

  const text = `${bodyText}\n\n${windowText}\n\nReview ${word.english}: ${link}`

  return { subject, html, text }
}

export async function decideNudge(
  deps: DecideNudgeDeps
): Promise<DecideNudgeResult> {
  const lastReviewedAt = await deps.findLastReviewedAt()

  if (practisedInWindow({ lastReviewedAt, now: deps.now })) {
    return { sent: false, reason: "practised" }
  }

  const word = await deps.pickWord()

  if (!word) {
    return { sent: false, reason: "no-words" }
  }

  const link = nudgeLink({ wordId: word.id, baseUrl: deps.baseUrl })
  const { subject, html, text } = renderNudge({ word, link })

  await deps.send({
    to: deps.to,
    from: deps.from,
    subject,
    html,
    text,
  })

  return { sent: true, wordId: word.id, subject }
}
