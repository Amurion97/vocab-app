"use client"

import { useState, useTransition } from "react"
import type { Word } from "@prisma/client"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { parseIssues } from "@/lib/issues"
import { UsageCheckActions } from "@/components/usage-check-actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useUsageCheck } from "@/hooks/use-usage-check"

export function QuizCard({ word }: { word: Word }) {
  const router = useRouter()
  const reminders = parseIssues(word.issues)
  const [sentence, setSentence] = useState("")
  const [isNavigating, setIsNavigating] = useState(false)
  const [, startTransition] = useTransition()
  const {
    result,
    error,
    isBusy,
    isChecking,
    canCancel,
    check,
    cancel,
    reset,
  } = useUsageCheck()

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isChecking) {
      return
    }
    check({ wordId: word.id, sentence })
  }

  function onTryAgain() {
    reset()
  }

  function onNext() {
    setIsNavigating(true)
    startTransition(() => {
      router.push(`/review?after=${word.id}`)
      router.refresh()
    })
  }

  const grammarIssues = result?.issues.filter((issue) => issue.source === "grammar") ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{word.english}</CardTitle>
        <CardDescription>
          Vietnamese meaning: {word.vietnamese}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">Reviewed {word.timesReviewed}</Badge>
          <Badge variant="outline">Correct {word.timesCorrect}</Badge>
          <Badge variant={word.timesWrong > 0 ? "destructive" : "outline"}>
            Wrong {word.timesWrong}
          </Badge>
        </div>
        {word.example ? (
          <p className="text-sm text-muted-foreground">
            Your note: {word.example}
          </p>
        ) : null}
        {reminders.length > 0 && !result ? (
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>Last time</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {reminders.map((issue) => (
                  <li key={`${issue.source}-${issue.message}`}>
                    {issue.source === "meaning" ? "Meaning: " : "Grammar: "}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {result ? (
          <div className="flex flex-col gap-3">
            <Alert variant={result.passed ? "default" : "destructive"}>
              {result.passed ? <CircleCheckIcon /> : <CircleAlertIcon />}
              <AlertTitle>
                {result.passed ? "Passed" : "Try again"}
              </AlertTitle>
              <AlertDescription>{result.feedback}</AlertDescription>
            </Alert>
            {!result.wordPresent ? (
              <p className="text-sm text-destructive">
                The target word was not found in your sentence.
              </p>
            ) : null}
            {result.suggestion && !result.passed ? (
              <p className="text-sm text-muted-foreground">
                Try: {result.suggestion}
              </p>
            ) : null}
            {grammarIssues.length > 0 ? (
              <Alert>
                <CircleAlertIcon />
                <AlertTitle>Grammar warnings</AlertTitle>
                <AlertDescription>
                  These do not fail the quiz.{" "}
                  <a href="https://languagetool.org">LanguageTool</a>
                  <ul className="mt-2 list-disc pl-4">
                    {grammarIssues.map((issue) => (
                      <li key={issue.message}>{issue.message}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}
            {result.grammarUnavailable ? (
              <p className="text-sm text-muted-foreground">
                Grammar check was unavailable. Meaning was still graded.
              </p>
            ) : null}
            {result.passed ? (
              <Button
                type="button"
                onClick={onNext}
                disabled={isNavigating}
              >
                {isNavigating ? "Loading…" : "Next word"}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  onClick={onTryAgain}
                  disabled={isNavigating}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onNext}
                  disabled={isNavigating}
                >
                  {isNavigating ? "Loading…" : "Next word"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="sentence">Write a sentence using this word</Label>
              <Textarea
                id="sentence"
                value={sentence}
                disabled={isChecking}
                onChange={(event) => {
                  setSentence(event.target.value)
                  reset()
                }}
                placeholder={`Use “${word.english}” in a sentence.`}
                required
              />
            </div>
            {isBusy ? (
              <Alert>
                <CircleAlertIcon />
                <AlertTitle>Usage check is busy</AlertTitle>
                <AlertDescription>Try again in a moment.</AlertDescription>
              </Alert>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <UsageCheckActions
              type="submit"
              variant="default"
              startDisabled={!sentence.trim()}
              isChecking={isChecking}
              canCancel={canCancel}
              onCancel={cancel}
            />
          </form>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Grammar suggestions by{" "}
        <Link href="https://languagetool.org" className="underline">
          LanguageTool
        </Link>
      </CardFooter>
    </Card>
  )
}
