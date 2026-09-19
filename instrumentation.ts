import type { Instrumentation } from "next"

import { logUnexpectedError } from "@/lib/app-log"

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined

  logUnexpectedError({
    action: context.routeType,
    error,
    digest,
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routerKind: context.routerKind,
  })
}
