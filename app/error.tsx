"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-medium">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground">
          This page hit an unexpected error. You can try again.
        </p>
      </div>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
      <div>
        <Button type="button" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </div>
    </div>
  )
}
