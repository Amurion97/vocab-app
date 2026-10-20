"use client"

import Link from "next/link"
import { CircleAlertIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  GRAMMAR_CHECKERS,
  type GrammarCheckSection,
  type GrammarChecker,
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
              <ul className="mt-2 list-disc pl-4">
                {check.suggestions.map((suggestion, index) => (
                  <li key={`${suggestion}-${index}`}>{suggestion}</li>
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
          {index === 0
            ? null
            : index === checkers.length - 1
              ? " and "
              : ", "}
          <Link href={CHECKER_LINKS[checker]} className="underline">
            {checker}
          </Link>
        </span>
      ))}
    </>
  )
}
