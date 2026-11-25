"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"

import { type QuizResult } from "@/app/actions"
import type { GrammarChecker } from "@/lib/services/issues"

const CANCEL_AFTER_MS = 2000

export type UsageCheckOk = Extract<QuizResult, { ok: true }>

export type UsageCheckBody = {
  sentence: string
  checkers: GrammarChecker[]
  wordId?: string
  english?: string
  vietnamese?: string
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

export function useUsageCheck() {
  const [isBusy, setIsBusy] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearCancelTimer() {
    if (cancelTimerRef.current !== null) {
      clearTimeout(cancelTimerRef.current)
      cancelTimerRef.current = null
    }
  }

  const mutation = useMutation<
    UsageCheckOk,
    Error,
    { body: UsageCheckBody; controller: AbortController }
  >({
    mutationFn: async ({ body, controller }) => {
      try {
        const response = await fetch("/api/check-usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (controller.signal.aborted) {
          return new Promise<never>(() => {})
        }
        const nextResult = (await response.json()) as QuizResult
        if (controller.signal.aborted) {
          return new Promise<never>(() => {})
        }
        if (
          !nextResult ||
          typeof nextResult !== "object" ||
          !("ok" in nextResult)
        ) {
          throw new Error("Could not check usage.")
        }
        if (!nextResult.ok) {
          if (nextResult.reason === "busy") {
            setIsBusy(true)
          }
          throw new Error(nextResult.error)
        }
        return nextResult
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) {
          return new Promise<never>(() => {})
        }
        if (caught instanceof Error) {
          throw caught
        }
        throw new Error("Could not check usage.")
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null
        }
      }
    },
    onSettled: () => {
      clearCancelTimer()
      setCanCancel(false)
    },
  })

  function reset() {
    setIsBusy(false)
    mutation.reset()
  }

  function cancel() {
    abortRef.current?.abort()
    clearCancelTimer()
    setCanCancel(false)
    mutation.reset()
  }

  function check(body: UsageCheckBody) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    reset()
    setCanCancel(false)
    clearCancelTimer()
    cancelTimerRef.current = setTimeout(() => {
      if (abortRef.current === controller) {
        setCanCancel(true)
      }
    }, CANCEL_AFTER_MS)

    mutation.mutate({ body, controller })
  }

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (cancelTimerRef.current !== null) {
        clearTimeout(cancelTimerRef.current)
      }
    }
  }, [])

  return {
    result: mutation.data ?? null,
    error: mutation.error?.message ?? null,
    isBusy,
    isChecking: mutation.isPending,
    canCancel,
    check,
    cancel,
    reset,
  }
}
