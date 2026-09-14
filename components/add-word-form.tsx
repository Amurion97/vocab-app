"use client"

import { useState, useTransition } from "react"

import { createWord, translateWord } from "@/app/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
  const [isPending, startTransition] = useTransition()
  const [isTranslating, startTranslate] = useTransition()

  function onTranslate() {
    setError(null)
    startTranslate(async () => {
      const result = await translateWord(english)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setVietnamese(result.vietnamese)
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
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a word</CardTitle>
        <CardDescription>
          Type an English word, translate it to Vietnamese, then save an optional
          example sentence.
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
                onChange={(event) => setEnglish(event.target.value)}
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
              onChange={(event) => setVietnamese(event.target.value)}
              placeholder="Translation appears here"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="example">Example sentence (optional)</Label>
            <Textarea
              id="example"
              value={example}
              onChange={(event) => setExample(event.target.value)}
              placeholder="The ephemeral bloom lasted only a day."
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving…" : "Save word"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
