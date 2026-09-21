"use client"

import { useState, useTransition } from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import Link from "next/link"

import { createWord, translateWord, type QuizResult } from "@/app/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function AddWordForm() {
  const [english, setEnglish] = useState("")
  const [vietnamese, setVietnamese] = useState("")
  const [example, setExample] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [usageResult, setUsageResult] = useState<Extract<
    QuizResult,
    { ok: true }
  > | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isTranslating, startTranslate] = useTransition()
  const [isChecking, startCheck] = useTransition()

  function clearUsage() {
    setUsageResult(null)
    setIsBusy(false)
  }

  function onTranslate() {
    setError(null)
    startTranslate(async () => {
      const result = await translateWord(english)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setVietnamese(result.vietnamese)
      clearUsage()
    })
  }

  function onCheckUsage() {
    setError(null)
    setIsBusy(false)
    setUsageResult(null)
    startCheck(async () => {
      try {
        const response = await fetch("/api/check-usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            english,
            vietnamese,
            sentence: example,
          }),
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
        setUsageResult(nextResult)
      } catch {
        setError("Could not check usage.")
      }
    })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createWord({ english, vietnamese, example })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEnglish("")
      setVietnamese("")
      setExample("")
      clearUsage()
    })
  }

  const grammarIssues =
    usageResult?.issues.filter((issue) => issue.source === "grammar") ?? []
  const canCheck =
    Boolean(english.trim() && vietnamese.trim() && example.trim()) &&
    !isChecking &&
    !isTranslating &&
    !isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a word</CardTitle>
        <CardDescription>
          Type an English word, translate it to Vietnamese, then optionally check
          an example sentence before you save it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="english">English</Label>
            <div className="flex gap-2">
              <Input
                id="english"
                value={english}
                onChange={(event) => {
                  setEnglish(event.target.value)
                  clearUsage()
                }}
                placeholder="ephemeral"
                required
              />
              <Button
                type="button"
                variant="outline"
                disabled={isTranslating || !english.trim()}
                onClick={onTranslate}
              >
                {isTranslating ? "Translating…" : "Translate"}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vietnamese">Vietnamese</Label>
            <Input
              id="vietnamese"
              value={vietnamese}
              onChange={(event) => {
                setVietnamese(event.target.value)
                clearUsage()
              }}
              placeholder="Translation appears here"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="example">Example sentence (optional)</Label>
            <Textarea
              id="example"
              value={example}
              onChange={(event) => {
                setExample(event.target.value)
                clearUsage()
              }}
              placeholder="The ephemeral bloom lasted only a day."
            />
            <Button
              type="button"
              variant="outline"
              disabled={!canCheck}
              onClick={onCheckUsage}
            >
              {isChecking ? "Checking…" : "Check usage"}
            </Button>
          </div>
          {usageResult ? (
            <div className="flex flex-col gap-3">
              <Alert variant={usageResult.passed ? "default" : "destructive"}>
                {usageResult.passed ? <CircleCheckIcon /> : <CircleAlertIcon />}
                <AlertTitle>
                  {usageResult.passed ? "Passed" : "Try again"}
                </AlertTitle>
                <AlertDescription>{usageResult.feedback}</AlertDescription>
              </Alert>
              {!usageResult.wordPresent ? (
                <p className="text-sm text-destructive">
                  The target word was not found in your sentence.
                </p>
              ) : null}
              {usageResult.suggestion && !usageResult.passed ? (
                <p className="text-sm text-muted-foreground">
                  Try: {usageResult.suggestion}
                </p>
              ) : null}
              {grammarIssues.length > 0 ? (
                <Alert>
                  <CircleAlertIcon />
                  <AlertTitle>Grammar warnings</AlertTitle>
                  <AlertDescription>
                    These do not fail the check.{" "}
                    <a href="https://languagetool.org">LanguageTool</a>
                    <ul className="mt-2 list-disc pl-4">
                      {grammarIssues.map((issue) => (
                        <li key={issue.message}>{issue.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null}
              {usageResult.grammarUnavailable ? (
                <p className="text-sm text-muted-foreground">
                  Grammar check was unavailable. Meaning was still graded.
                </p>
              ) : null}
            </div>
          ) : null}
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
            {isPending ? "Saving…" : "Save word"}
          </Button>
        </form>
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
