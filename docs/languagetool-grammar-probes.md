# LanguageTool probes beyond spelling

Captured 2026-10-22 from the public check endpoint, the same call `checkGrammar` makes.

```
POST https://api.languagetool.org/v2/check
Content-Type: application/x-www-form-urlencoded
text=<sentence>&language=en-US
```

A second pass on five empty sentences added `level=picky`. Nothing else was added: no enabled rules, no disabled categories.

## Server

- `software.name`: LanguageTool
- `software.version`: 6.9-SNAPSHOT
- `software.buildDate`: 2026-09-01 15:16:00 +0000
- `software.apiVersion`: 1
- `software.premium`: true
- `software.premiumHint`: You might be missing errors only the Premium version can find. Contact us at support<at>languagetoolplus.com.

That hint was on the response that supplied `software`, and the same build returned the matches below. An empty `matches` array is what this endpoint sent back for that sentence.

For every sentence shorter than the long comma example, `context.text` was the whole sentence and `context.offset` / `context.length` matched the match offset and length. Each of those sentences returned one match.

## Matches

| Sentence | Rule | Category | issueType | Span | Replacements |
| --- | --- | --- | --- | --- | --- |
| She ate a apple. | `EN_A_VS_AN` | MISC | misspelling | "a" | "an" |
| She waited a hour. | `EN_A_VS_AN` | MISC | misspelling | "a" | "an" |
| I have a books. | `A_NNS` | GRAMMAR | grammar | "a books" | "a book", "books" |
| She is best student in the class. | `THE_SUPERLATIVE` | GRAMMAR | grammar | "is best" | "is the best" |
| He go to school every day. | `HE_VERB_AGR` | GRAMMAR | grammar | "go" | "goes", "went" |
| I think he go to school every day. | `HE_VERB_AGR` | GRAMMAR | grammar | "go" | "goes", "went" |
| Yesterday he go to school. | `HE_VERB_AGR` | GRAMMAR | grammar | "go" | "goes", "went" |
| The dog wagged it's tail. | `IT_IS_2` | TYPOS | misspelling | "it's" | "its" |
| She depends of her brother. | `DEPEND_ON` | GRAMMAR | grammar | "depends of" | "depends on" |
| He is married with her. | `MARRY_WITH` | COLLOCATIONS | grammar | "married with" | "married to" |
| I look forward to see you. | `ADMIT_ENJOY_VB` | GRAMMAR | grammar | "to see" | "to seeing" |
| She don't like coffee. | `HE_VERB_AGR` | GRAMMAR | grammar | "do" | "does", "did" |
| The books is on the table. | `AGREEMENT_SENT_START` | GRAMMAR | grammar | "is" | "are" |
| The books is old. | `AGREEMENT_SENT_START` | GRAMMAR | grammar | "is" | "are" |
| However we left early. | `SENT_START_CONJUNCTIVE_LINKING_ADVERB_COMMA` | PUNCTUATION | uncategorized | "However" | "However," |
| I have less friends than you. | `FEWER_LESS` | GRAMMAR | grammar | "less" | "fewer" |
| He did a mistake. | `DID_A_MISTAKE` | COLLOCATIONS | grammar | "did" | "made" |
| Despite of the rain we left. | `DESPITE_OF` | GRAMMAR | grammar | "Despite of" | "Despite" |
| I have been here since three years. | `SINCE_FOR` | CONFUSED_WORDS | misspelling | "since" | "for" |
| I have been spending the entire afternoo … | `COMMA_COMPOUND_SENTENCE_2` | PUNCTUATION | uncategorized | " and" | ", and" |

## Message text

Messages are copied from the response. Several use curly quotes. `EN_A_VS_AN` puts a non-breaking space after `e.g.`

### `EN_A_VS_AN`

Sentence: `She ate a apple.`

- shortMessage: "Wrong article"
- offset 8, length 1
- message: Use “an” instead of ‘a’ if the following word starts with a vowel sound, e.g. ‘an article’, ‘an hour’.

### `A_NNS`

Sentence: `I have a books.`

- shortMessage: ""
- offset 7, length 7
- message: The plural noun “books” cannot be used with the article “a”. Did you mean “a book” or “books”?

### `THE_SUPERLATIVE`

Sentence: `She is best student in the class.`

- shortMessage: "Missing determiner"
- offset 4, length 7
- message: A determiner may be missing.

### `HE_VERB_AGR`

Sentence: `He go to school every day.`

- shortMessage: "Agreement error"
- offset 3, length 2
- message: The pronoun ‘He’ is usually used with a third-person or a past tense verb.

### `HE_VERB_AGR`

Sentence: `I think he go to school every day.`

- shortMessage: "Agreement error"
- offset 11, length 2
- message: The pronoun ‘he’ is usually used with a third-person or a past tense verb.

### `IT_IS_2`

Sentence: `The dog wagged it's tail.`

- shortMessage: ""
- offset 15, length 4
- message: It seems that the possessive pronoun “its” fits better in this context.

### `DEPEND_ON`

Sentence: `She depends of her brother.`

- shortMessage: "Missing preposition"
- offset 4, length 10
- message: The verb ‘to depend’ requires the preposition ‘(up)on’.

### `MARRY_WITH`

Sentence: `He is married with her.`

- shortMessage: "Collocation error"
- offset 6, length 12
- message: The correct expression is “being married to somebody”.

### `ADMIT_ENJOY_VB`

Sentence: `I look forward to see you.`

- shortMessage: "Grammatical problem: use ‘ing’"
- offset 15, length 6
- message: In the grammatical structure ‘look + forward + to + verb’, the verb ‘to’ is used with the gerund.

### `HE_VERB_AGR`

Sentence: `She don't like coffee.`

- shortMessage: "Agreement error"
- offset 4, length 2
- message: The pronoun ‘She’ is usually used with a third-person or a past tense verb.

### `AGREEMENT_SENT_START`

Sentence: `The books is on the table.`

- shortMessage: "Possible agreement error"
- offset 10, length 2
- message: You should probably use: “are”.

### `SENT_START_CONJUNCTIVE_LINKING_ADVERB_COMMA`

Sentence: `However we left early.`

- shortMessage: "Punctuation error"
- offset 0, length 7
- message: A comma may be missing after the conjunctive/linking adverb ‘However’.

### `FEWER_LESS`

Sentence: `I have less friends than you.`

- shortMessage: "Grammatical error"
- offset 7, length 4
- message: Did you mean “fewer”? The noun “friends” is countable.

### `DID_A_MISTAKE`

Sentence: `He did a mistake.`

- shortMessage: ""
- offset 3, length 3
- message: Did you mean “made”?

### `DESPITE_OF`

Sentence: `Despite of the rain we left.`

- shortMessage: ""
- offset 0, length 10
- message: Did you mean “Despite” (or, alternatively, ‘in spite of’)?

### `SINCE_FOR`

Sentence: `I have been here since three years.`

- shortMessage: "Commonly confused word"
- offset 17, length 5
- message: Did you mean “for”? (‘since’ refers to a point in time, whereas ‘for’ refers to a period)

### `COMMA_COMPOUND_SENTENCE_2`

Sentence: `I have been spending the entire afternoon reading about how …`

- shortMessage: ""
- offset 133, length 4
- message: Use a comma before “and” if it connects two independent clauses (unless they are closely connected and short).

Same message on another sentence from this run:

- `EN_A_VS_AN` on `She waited a hour.` (offset 11, length 1, span `a`, replacement `an`).
- `HE_VERB_AGR` on `Yesterday he go to school.` uses the lowercase `he` message above. Span `go`, offset 13, length 2, replacements `goes`, `went`.
- `AGREEMENT_SENT_START` on `The books is old.` (offset 10, length 2, span `is`, replacement `are`).

## Sentences that returned no matches

Each of these was `matches: []` with `language=en-US` and no `level`.

### Missing article before a singular noun

- `She bought book.`
- `This is book about dogs.`
- `She is teacher at my school.`
- `I bought car yesterday.`
- `He gave me book.`
- `I saw cat on the roof.`
- `Please open door.`
- `I need umbrella.`
- `This is most beautiful painting here.`
- `Go to store and buy milk.`

`level=picky` was also empty for `She bought book.`, `She is teacher at my school.`, `I saw cat on the roof.`, and `This is most beautiful painting here.`

The nearest determiner hit in this run is `THE_SUPERLATIVE` on `She is best student in the class.`: message `A determiner may be missing.`, span `is best`, replacement `is the best`. `A_NNS` on `I have a books.` flags an article that is present with a plural noun. `EN_A_VS_AN` flags `a` before a vowel sound, and the API labels that rule `issueType: misspelling`, category `MISC`.

### Other empty sentences

- `She is interested on music.`
- `I arrived to the station.`
- `They listen music every night.`
- `Can you explain me this word?`
- `I know the books is on the table.`
- `Yesterday the books is on the table.`

`level=picky` was also empty for `She is interested on music.`

`She depends of her brother.` did match (`DEPEND_ON`, span `depends of`, replacement `depends on`). `He is married with her.` did match (`MARRY_WITH`, span `married with`, replacement `married to`). A wrong preposition is not a reliable class on this endpoint: some fixed expressions match and some common learner sentences come back empty.

`The books is on the table.` and `The books is old.` matched `AGREEMENT_SENT_START`. `I know the books is on the table.` and `Yesterday the books is on the table.` returned no matches. `He go to school every day.`, `I think he go to school every day.`, and `Yesterday he go to school.` all matched `HE_VERB_AGR`, so that agreement rule is not limited to a sentence-initial pronoun.

## Shapes a one-word spelling fixture does not cover

### The repair is not the flagged span

| Span | Replacement | Rule |
| --- | --- | --- |
| `a` | `an` | `EN_A_VS_AN` |
| `a books` | `a book`, `books` | `A_NNS` |
| `is best` | `is the best` | `THE_SUPERLATIVE` |
| `go` | `goes`, `went` | `HE_VERB_AGR` |
| `depends of` | `depends on` | `DEPEND_ON` |
| `married with` | `married to` | `MARRY_WITH` |
| `to see` | `to seeing` | `ADMIT_ENJOY_VB` |
| `However` | `However,` | `SENT_START_CONJUNCTIVE_LINKING_ADVERB_COMMA` |
| `Despite of` | `Despite` | `DESPITE_OF` |
| `it's` | `its` | `IT_IS_2` |

`it's` is four characters, apostrophe included. The highlight length has to follow that span, not a normalized form.

### Multi-word spans

`a books` (7), `is best` (7), `depends of` (10), `married with` (12), `to see` (6), `Despite of` (10).

### Leading space inside an ellipsized window

Sentence (173 characters):

```
I have been spending the entire afternoon reading about how the scheduler decides to park a worker before the queue drains completely and then the books is resumed later on.
```

- Rule `COMMA_COMPOUND_SENTENCE_2`, category `PUNCTUATION`, issueType `uncategorized`.
- Sentence offset 133, length 4. The slice is " and" (a leading space plus `and`).
- Replacement: ", and".
- `context.text`: "...orker before the queue drains completely and then the books is resumed later on."
- `context.offset` 43, `context.length` 4.
- Message: Use a comma before “and” if it connects two independent clauses (unless they are closely connected and short).

The window starts with `...` glued to the middle of `worker` (`...orker`). There is no space after the ellipsis. This was the only match on that sentence. `the books is` inside it did not produce `AGREEMENT_SENT_START`.

`span` in `lib/languagetool.ts` trims the excerpt before quoting it, so this slice becomes `and` in the reminder. The highlight length follows the trimmed word.

### `issueType` does not separate spelling from grammar

| issueType | Rules in this run |
| --- | --- |
| `misspelling` | `EN_A_VS_AN`, `IT_IS_2`, `SINCE_FOR` |
| `grammar` | `A_NNS`, `THE_SUPERLATIVE`, `HE_VERB_AGR`, `DEPEND_ON`, `MARRY_WITH`, `ADMIT_ENJOY_VB`, `AGREEMENT_SENT_START`, `FEWER_LESS`, `DID_A_MISTAKE`, `DESPITE_OF` |
| `uncategorized` | `SENT_START_CONJUNCTIVE_LINKING_ADVERB_COMMA`, `COMMA_COMPOUND_SENTENCE_2` |

Filtering to `issueType: misspelling` would keep `a`/`an` and drop `He go`. The checker does not filter on `issueType` or `category`. `LanguageToolMatch` reads `message`, `shortMessage`, `offset`, `length`, `context`, and `replacements`.

### Empty `shortMessage`

`A_NNS`, `IT_IS_2`, `DID_A_MISTAKE`, `DESPITE_OF`, and `COMMA_COMPOUND_SENTENCE_2` sent `shortMessage: ""`. Each still had a `message`, which is what `checkGrammar` prefers.

## What the app keeps

`checkGrammar` turns each match into `{ message, highlight?, replacements? }`. The message is LanguageTool's `message` plus the quoted span. `replacements` are the trimmed `value` strings. Rule id, category, and issueType are not stored.

`SuggestionText` in `components/grammar-checkers.tsx` renders that message, marks `highlight`, and when replacements exist appends `Try:` plus the list joined with commas.

## Fixture candidates

Frozen payloads worth adding to `test/languagetool.test.ts`, one per shape. Paste the live match, including `context`, rather than a hand-built one.

1. `She ate a apple.` — one-character article span, replacement differs, `issueType` is `misspelling`.
2. `I have a books.` — multi-word span, two replacements, empty `shortMessage`.
3. `She is best student in the class.` — missing determiner on a superlative; the span is `is best`, the repair inserts `the`.
4. `She depends of her brother.` — multi-word preposition span.
5. `The dog wagged it's tail.` — apostrophe inside the flagged token.
6. The long sentence above — ellipsized `context.text` and a span whose first character is a space.

Skip a frozen fixture for bare `She bought book.` until a call actually returns a match. Asserting a reminder for it would encode a rule this endpoint did not fire.
