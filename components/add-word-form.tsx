"use client"

import { useState, useTransition } from "react"
import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { createWord, translateWord } from "@/app/actions"
import {
  GrammarCheckSections,
  GrammarCheckerCredit,
  GrammarCheckerPicker,
} from "@/components/grammar-checkers"
import { UsageCheckActions } from "@/components/usage-check-actions"
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
import { useUsageCheck } from "@/hooks/use-usage-check"
import type { GrammarChecker } from "@/lib/issues"

export function AddWordForm() {
  const [english, setEnglish] = useState("")
  const [vietnamese, setVietnamese] = useState("")
  const [example, setExample] = useState("")
  const [checkers, setCheckers] = useState<GrammarChecker[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isTranslating, startTranslate] = useTransition()
  const {
    result: usageResult,
    error: usageError,
    isBusy,
    isChecking,
    canCancel,
    check,
    cancel,
    reset,
  } = useUsageCheck()

  const fieldsLocked = isChecking

  function onTranslate() {
    setFormError(null)
    startTranslate(async () => {
      const result = await translateWord(english)
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      setVietnamese(result.vietnamese)
      reset()
    })
  }

  function onCheckUsage() {
    setFormError(null)
    if (checkers.length === 0) {
      return
    }
    check({
      english,
      vietnamese,
      sentence: example,
      checkers,
    })
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isChecking) {
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result = await createWord({ english, vietnamese, example })
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      setEnglish("")
      setVietnamese("")
      setExample("")
      setCheckers([])
      reset()
    })
  }

  const error = usageError ?? formError

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
                disabled={fieldsLocked}
                onChange={(event) => {
                  setEnglish(event.target.value)
                  reset()
                }}
                placeholder="ephemeral"
                required
              />
              <Button
                type="button"
                variant="outline"
                disabled={fieldsLocked || isTranslating || !english.trim()}
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
              className="font-vietnamese"
              lang="vi"
              value={vietnamese}
              disabled={fieldsLocked}
              onChange={(event) => {
                setVietnamese(event.target.value)
                reset()
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
              disabled={fieldsLocked}
              onChange={(event) => {
                setExample(event.target.value)
                reset()
              }}
              placeholder="The ephemeral bloom lasted only a day."
            />
            <GrammarCheckerPicker
              selected={checkers}
              disabled={fieldsLocked}
              onChange={(next) => {
                setCheckers(next)
                reset()
              }}
            />
            <UsageCheckActions
              startDisabled={
                !english.trim() ||
                !vietnamese.trim() ||
                !example.trim() ||
                checkers.length === 0 ||
                isTranslating ||
                isPending
              }
              isChecking={isChecking}
              canCancel={canCancel}
              onCheck={onCheckUsage}
              onCancel={cancel}
            />
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
              <GrammarCheckSections
                checks={usageResult.grammarChecks}
                warningNote="These do not fail the check."
              />
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
          <Button type="submit" disabled={fieldsLocked || isPending}>
            {isPending ? "Saving…" : "Save word"}
          </Button>
        </form>
      </CardContent>
      {checkers.length > 0 ? (
        <CardFooter className="text-xs text-muted-foreground">
          <GrammarCheckerCredit checkers={checkers} />
        </CardFooter>
      ) : null}
    </Card>
  )
}
