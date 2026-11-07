"use client"

import Link from "next/link"
import { CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  GRAMMAR_CHECKERS,
  type GrammarCheckSection,
  type GrammarChecker,
  type GrammarSuggestion,
} from "@/lib/issues"

const CHECKER_LINKS: Record<GrammarChecker, string> = {
  LanguageTool: "https://languagetool.org",
  Sapling: "https://sapling.ai",
}

export function GrammarCheckerPicker({
  selected,
  disabled,
  onChange,
}: {
  selected: GrammarChecker[]
  disabled: boolean
  onChange: (next: GrammarChecker[]) => void
}) {
  function toggle(checker: GrammarChecker) {
    onChange(
      selected.includes(checker)
        ? selected.filter((item) => item !== checker)
        : [...selected, checker]
    )
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Grammar checkers</legend>
      {GRAMMAR_CHECKERS.map((checker) => (
        <label key={checker} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(checker)}
            disabled={disabled}
            onChange={() => toggle(checker)}
          />
          {checker}
        </label>
      ))}
    </fieldset>
  )
}

function HighlightedMessage({
  message,
  highlight,
}: {
  message: string
  highlight: GrammarSuggestion["highlight"]
}) {
  if (!highlight) {
    return message
  }

  const end = highlight.offset + highlight.length
  return (
    <>
      {message.slice(0, highlight.offset)}
      <mark className="rounded-sm bg-foreground/10 px-0.5 font-medium text-foreground">
        {message.slice(highlight.offset, end)}
      </mark>
      {message.slice(end)}
    </>
  )
}

function SuggestionText({ suggestion }: { suggestion: GrammarSuggestion }) {
  const { quote, replacements = [] } = suggestion
  return (
    <div className="space-y-1">
      <p>
        {quote ? (
          <>
            {quote.base}{" "}
            <span className="font-medium text-foreground">{quote.word}</span>
          </>
        ) : (
          <HighlightedMessage
            message={suggestion.message}
            highlight={suggestion.highlight}
          />
        )}
      </p>

      {quote?.context ? (
        <p className="border-l-2 border-border pl-3 leading-relaxed">
          <HighlightedMessage
            message={quote.context}
            highlight={quote.highlight}
          />
        </p>
      ) : null}

      {replacements.length > 0 ? (
        <p>
          <span className="text-xs tracking-wide uppercase">Try</span>{" "}
          <span className="font-medium text-foreground">
            {replacements.join(", ")}
          </span>
        </p>
      ) : null}
    </div>
  )
}

export function GrammarCheckSections({
  checks,
  warningNote,
}: {
  checks: GrammarCheckSection[]
  warningNote: string
}) {
  return checks.map((check) => (
    <Alert key={check.checker}>
      <CircleAlertIcon />
      <AlertTitle>{check.checker}</AlertTitle>
      <AlertDescription>
        {check.available ? (
          check.suggestions.length > 0 ? (
            <>
              {warningNote}
              <ul className="mt-2 divide-y divide-border">
                {check.suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.message}-${index}`}
                    className="py-2 first:pt-0 last:pb-0"
                  >
                    <SuggestionText suggestion={suggestion} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            "No suggestions."
          )
        ) : (
          `${check.checker} is unavailable. Meaning was still graded.`
        )}
      </AlertDescription>
    </Alert>
  ))
}

export function GrammarCheckerCredit({
  checkers,
}: {
  checkers: GrammarChecker[]
}) {
  if (checkers.length === 0) {
    return null
  }

  return (
    <>
      Grammar suggestions by{" "}
      {checkers.map((checker, index) => (
        <span key={checker}>
          {index === 0 ? null : index === checkers.length - 1 ? " and " : ", "}
          <Link href={CHECKER_LINKS[checker]} className="underline">
            {checker}
          </Link>
        </span>
      ))}
    </>
  )
}
