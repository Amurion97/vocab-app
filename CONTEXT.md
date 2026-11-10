# Vocab

A personal vocabulary list: save English words with Vietnamese meanings, then practice them by writing sentences.

## Language

**Word**:
An English vocabulary item with a Vietnamese meaning.
_Avoid_: entry, card, item

**Example**:
An optional note sentence stored on a **Word**.
_Avoid_: using “example” for the text written during **Review**

**Sentence**:
The text the student writes during a **Review** to use the **Word**.
_Avoid_: example, answer, response

**Review**:
A practice turn that asks the student to use one **Word** in a **Sentence**.
_Avoid_: quiz, AI review

**Review attempt**:
A **Usage check** that produced a **Meaning check** result and was recorded on the **Word**.

**Usage check**:
The grading of one **Sentence** against one **Word**.
_Avoid_: AI review

**Meaning check**:
The part of a **Usage check** that judges whether the **Word** is used with the intended sense.

**Grammar check**:
The part of a **Usage check** that reports grammar warnings without failing the **Review**.

**Busy**:
A **Usage check** that ended without a **Meaning check** result because the grader had no capacity.

**Nudge**:
The daily email sent when the student has no **Review attempt** inside that **Practice day**'s **Practice window**, naming one **Word**.
_Avoid_: reminder, notification, digest

**Pinned word**:
The **Word** a **Nudge** names, which **Review** serves when the student follows the link.
_Avoid_: email word, reminder word

**Practice day**:
The span from 06:00 `Asia/Ho_Chi_Minh` until the next 06:00. A **Review attempt** in that span is practice for that day.
_Avoid_: calendar day, today, midnight

**Practice window**:
The span from 06:00 up to 20:00 inside one **Practice day**.
_Avoid_: day, schedule window

## Relationships

- A **Word** may have one **Example**
- A **Review** presents exactly one **Word**
- The student submits one **Sentence** per **Review**
- A **Usage check** grades that **Sentence** with a **Meaning check** and a **Grammar check**
- A **Review attempt** is recorded only when the **Meaning check** returns a result
- A **Grammar check** cannot fail a **Usage check**
- **Busy** is not a **Review attempt**
- A **Nudge** names exactly one **Pinned word**
- A **Nudge** is not a **Review** and records nothing on a **Word**
- A **Review attempt** inside the **Practice window** suppresses that **Practice day**'s **Nudge**
- A **Review attempt** outside the **Practice window** does not suppress a **Nudge**
- A **Pinned word** is already practised when the student opens it and a **Review attempt** for it is already on the current **Practice day**, at or before that opening

## Example dialogue

> **Dev:** "When the student submits an example and the AI review is busy, do we still count a **Review attempt**?"
> **Domain expert:** "They submitted a **Sentence**, not an **Example**. **Busy** means the **Meaning check** never finished, so there is no **Review attempt** — keep the **Sentence** and let them run the **Usage check** again."

> **Dev:** "The student reviews at 12:30am, then opens the nudge at 11pm. Have they already practised that word today? What about a review at 8:10pm?"
> **Domain expert:** "12:30am is before 06:00, so that **Review attempt** belongs to the previous **Practice day**. 8:10pm is on the current **Practice day**, so the **Pinned word** is already practised, and it still does not suppress the **Nudge**: 8:10pm is outside the **Practice window**."

## Flagged ambiguities

- “example” was used for both the saved **Example** note and the **Sentence** written in **Review** — resolved: these are distinct.
- “AI review” / “quiz” were used for **Usage check** and **Review** — resolved: **Review** is the practice turn; **Usage check** is the grade. Existing type names `QuizCard` and `QuizResult` stay.
- “reminder” was already taken by the previous attempt's issues in `quiz-card.tsx` (`reminders`, `reminderLabel`); the email is a **Nudge**.
- “today” was used for both the calendar date and the span that starts at 06:00 — resolved: that span is a **Practice day**. The **Practice window** is only the 06:00–20:00 part that suppresses a **Nudge**. The card’s “today” means the current **Practice day**.
