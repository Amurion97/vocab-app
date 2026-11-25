"use client"

import "@/components/wdyr"
import { useState, useTransition } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { Word } from "@prisma/client"
import { CircleAlertIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { deleteWord, updateWord } from "@/app/actions"
import { parseIssues, reminderLabel } from "@/lib/services/issues"
import {
  getWordsSnapshot,
  patchWord,
  removeWord,
  restoreWords,
  wordKeys,
} from "@/lib/word-queries"
import { cn } from "@/lib/utils"
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
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

export function WordCard({ word }: { word: Word }) {
  const queryClient = useQueryClient()
  const issues = parseIssues(word.issues)
  const [editing, setEditing] = useState(false)
  const [vietnamese, setVietnamese] = useState(word.vietnamese)
  const [example, setExample] = useState(word.example ?? "")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, startSaveTransition] = useTransition()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  function onSave() {
    setSaveError(null)
    startSaveTransition(async () => {
      const snapshot = getWordsSnapshot(queryClient)
      // Patch the Word before the round trip so the edit lands instantly.
      patchWord(queryClient, {
        ...word,
        vietnamese,
        example: example || null,
      })

      try {
        const result = await updateWord(word.id, { vietnamese, example })
        if (!result.ok) {
          restoreWords(queryClient, snapshot)
          setSaveError(result.error)
          return
        }
        patchWord(queryClient, result.word)
        setEditing(false)
      } catch (err) {
        restoreWords(queryClient, snapshot)
        setSaveError(
          err instanceof Error ? err.message : "Failed to update word."
        )
      }
    })
  }

  function onDelete() {
    setDeleteError(null)
    startDeleteTransition(async () => {
      try {
        const result = await deleteWord(word.id)
        if (!result.ok) {
          setDeleteError(result.error)
          return
        }
        // Server confirmed: close dialog, remove from cache, and refetch clean cursors.
        setDeleteDialogOpen(false)
        removeWord(queryClient, word.id)
        await queryClient.invalidateQueries({ queryKey: wordKeys.all })
      } catch (err) {
        setDeleteError(
          err instanceof Error ? err.message : "Failed to delete word."
        )
      }
    })
  }

  return (
    <Card
      className={cn(
        "group transition-opacity duration-200",
        isDeleting && "pointer-events-none opacity-50"
      )}
    >
      <CardHeader>
        <CardTitle>{word.english}</CardTitle>
        <CardDescription>{word.vietnamese}</CardDescription>
        <CardAction className="flex gap-1 opacity-100 transition-opacity group-hover:opacity-100 md:opacity-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit word"
            disabled={isDeleting}
            onClick={() => {
              setVietnamese(word.vietnamese)
              setExample(word.example ?? "")
              setEditing((value) => !value)
            }}
          >
            <PencilIcon />
          </Button>
          <Dialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              if (isDeleting) return
              setDeleteDialogOpen(open)
              if (!open) {
                setDeleteError(null)
              }
            }}
          >
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete word"
                  disabled={isDeleting}
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
              {deleteError ? (
                <p className="text-sm text-destructive">{deleteError}</p>
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={onDelete}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
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
                {issues.map((issue, index) => (
                  <li
                    key={`${issue.source}-${issue.checker ?? ""}-${issue.message}-${index}`}
                  >
                    {reminderLabel(issue)}
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
            {saveError ? (
              <p className="text-sm text-destructive">{saveError}</p>
            ) : null}
            <Button type="button" disabled={isSaving} onClick={onSave}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

WordCard.whyDidYouRender = true

export function WordCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-5 w-24" />
        </CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-16" />
        </CardDescription>
        <CardAction className="flex gap-1">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
    </Card>
  )
}
