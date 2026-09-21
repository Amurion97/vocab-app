"use client"

import { useEffect, useRef, useState, useTransition } from "react"

import { type QuizResult } from "@/app/actions"

const CANCEL_AFTER_MS = 2000

export type UsageCheckOk = Extract<QuizResult, { ok: true }>

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError"
}

export function useUsageCheck() {
  const [result, setResult] = useState<UsageCheckOk | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [canCancel, setCanCancel] = useState(false)
  const [isChecking, startCheck] = useTransition()
  const abortRef = useRef<AbortController | null>(null)
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearCancelTimer() {
    if (cancelTimerRef.current !== null) {
      clearTimeout(cancelTimerRef.current)
      cancelTimerRef.current = null
    }
  }

  function reset() {
    setResult(null)
    setError(null)
    setIsBusy(false)
  }

  function cancel() {
    abortRef.current?.abort()
  }

  function check(body: Record<string, string>) {
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

    startCheck(async () => {
      try {
        const response = await fetch("/api/check-usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (controller.signal.aborted) {
          return
        }
        const nextResult = (await response.json()) as QuizResult
        if (controller.signal.aborted) {
          return
        }
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
      } catch (caught) {
        if (controller.signal.aborted || isAbortError(caught)) {
          return
        }
        setError("Could not check usage.")
      } finally {
        if (abortRef.current === controller) {
          clearCancelTimer()
          setCanCancel(false)
          abortRef.current = null
        }
      }
    })
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
    result,
    error,
    isBusy,
    isChecking,
    canCancel,
    check,
    cancel,
    reset,
  }
}
