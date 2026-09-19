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

## Relationships

- A **Word** may have one **Example**
- A **Review** presents exactly one **Word**
- The student submits one **Sentence** per **Review**
- A **Usage check** grades that **Sentence** with a **Meaning check** and a **Grammar check**
- A **Review attempt** is recorded only when the **Meaning check** returns a result
- A **Grammar check** cannot fail a **Usage check**
- **Busy** is not a **Review attempt**

## Example dialogue

> **Dev:** "When the student submits an example and the AI review is busy, do we still count a **Review attempt**?"
> **Domain expert:** "They submitted a **Sentence**, not an **Example**. **Busy** means the **Meaning check** never finished, so there is no **Review attempt** — keep the **Sentence** and let them run the **Usage check** again."

## Flagged ambiguities

- “example” was used for both the saved **Example** note and the **Sentence** written in **Review** — resolved: these are distinct.
- “AI review” / “quiz” were used for **Usage check** and **Review** — resolved: **Review** is the practice turn; **Usage check** is the grade. Existing type names `QuizCard` and `QuizResult` stay.
