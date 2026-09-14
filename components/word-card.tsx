"use client"

import { useState, useTransition } from "react"
import type { Word } from "@prisma/client"
import { CircleAlertIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { deleteWord, updateWord } from "@/app/actions"
import { parseIssues } from "@/lib/issues"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function WordCard({ word }: { word: Word }) {
  const issues = parseIssues(word.issues)
  const [editing, setEditing] = useState(false)
  const [vietnamese, setVietnamese] = useState(word.vietnamese)
  const [example, setExample] = useState(word.example ?? "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function onSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateWord(word.id, { vietnamese, example })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEditing(false)
    })
  }

  function onDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteWord(word.id)
      if (!result.ok) {
        setError(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{word.english}</CardTitle>
        <CardDescription>{word.vietnamese}</CardDescription>
        <CardAction className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit word"
            onClick={() => {
              setVietnamese(word.vietnamese)
              setExample(word.example ?? "")
              setEditing((value) => !value)
            }}
          >
            <PencilIcon />
          </Button>
          <Dialog>
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete word"
                />
              }
            >
              <Trash2Icon />
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {word.english}?</DialogTitle>
                <DialogDescription>
                  This removes the word and its review stats.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isPending}
                  onClick={onDelete}
                >
                  {isPending ? "Deleting…" : "Delete"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary">Reviewed {word.timesReviewed}</Badge>
          <Badge variant="outline">Correct {word.timesCorrect}</Badge>
          <Badge variant={word.timesWrong > 0 ? "destructive" : "outline"}>
            Wrong {word.timesWrong}
          </Badge>
        </div>
        {word.example ? (
          <p className="text-sm text-muted-foreground">
            Example: {word.example}
          </p>
        ) : null}
        {word.lastSentence ? (
          <p className="text-sm text-muted-foreground">
            Last quiz: {word.lastSentence}
          </p>
        ) : null}
        {issues.length > 0 ? (
          <Alert>
            <CircleAlertIcon />
            <AlertTitle>Open reminders</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {issues.map((issue) => (
                  <li key={`${issue.source}-${issue.message}`}>
                    {issue.source === "meaning" ? "Meaning: " : "Grammar: "}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {editing ? (
          <div className="flex flex-col gap-3 border-t pt-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`vi-${word.id}`}>Vietnamese</Label>
              <Input
                id={`vi-${word.id}`}
                value={vietnamese}
                onChange={(event) => setVietnamese(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`ex-${word.id}`}>Example sentence</Label>
              <Textarea
                id={`ex-${word.id}`}
                value={example}
                onChange={(event) => setExample(event.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <Button type="button" disabled={isPending} onClick={onSave}>
              {isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
