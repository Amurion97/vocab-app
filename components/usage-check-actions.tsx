"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "cn"

export function UsageCheckActions({
  type = "button",
  variant = "outline",
  startDisabled,
  isChecking,
  canCancel,
  onCheck,
  onCancel,
}: {
  type?: "button" | "submit"
  variant?: "default" | "outline"
  startDisabled: boolean
  isChecking: boolean
  canCancel: boolean
  onCheck?: () => void
  onCancel: () => void
}) {
  if (isChecking) {
    return (
      <div className="relative">
        <div
          role="status"
          aria-live="polite"
          className={cn(buttonVariants({ variant }), "w-full opacity-50")}
        >
          Checking…
        </div>
        {canCancel ? (
          <button
            type="button"
            className={cn(
              "absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none",
              variant === "default"
                ? "text-primary-foreground"
                : "text-foreground"
            )}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <Button
      type={type}
      variant={variant}
      disabled={startDisabled}
      onClick={type === "button" ? onCheck : undefined}
    >
      Check usage
    </Button>
  )
}
