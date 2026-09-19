"use client"

import { useState, useTransition } from "react"
import type { Word } from "@prisma/client"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { type QuizResult } from "@/app/actions"
import { parseIssues } from "@/lib/issues"
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

export function QuizCard({ word }: { word: Word }) {
  const router = useRouter()
  const reminders = parseIssues(word.issues)
  const [sentence, setSentence] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [result, setResult] = useState<Extract<QuizResult, { ok: true }> | null>(
    null
  )
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsBusy(false)
    startTransition(async () => {
      try {
        const response = await fetch("/api/check-usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wordId: word.id, sentence }),
        })
        const nextResult = (await response.json()) as QuizResult
        if (!nextResult || typeof nextResult !== "object" || !("ok" in nextResult)) {
          setError("Could not check usage.")
          return
        }
        if (!nextResult.ok) {
          if (nextResult.reason === "busy") {
            setIsBusy(true)
          }
          setError(nextResult.error)
          return
        }
        setResult(nextResult)
      } catch {
        setError("Could not check usage.")
      }
    })
  }

  function onTryAgain() {
    setResult(null)
    setError(null)
    setIsBusy(false)
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
                onChange={(event) => setSentence(event.target.value)}
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Checking…" : "Check usage"}
            </Button>
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
