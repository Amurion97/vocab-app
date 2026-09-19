function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      errorType: error.name,
      errorMessage: error.message,
      ...(process.env.NODE_ENV !== "production" && error.stack
        ? { stack: error.stack }
        : {}),
    }
  }

  if (typeof error === "object" && error !== null) {
    const record = error as { name?: unknown; message?: unknown; code?: unknown }
    return {
      errorType: typeof record.name === "string" ? record.name : undefined,
      errorMessage:
        typeof record.message === "string" ? record.message : undefined,
      code: typeof record.code === "string" ? record.code : undefined,
    }
  }

  if (error === undefined) {
    return {}
  }

  return { errorMessage: String(error) }
}

type LogFields = {
  action: string
  error?: unknown
  [key: string]: unknown
}

function logError(kind: "expected" | "unexpected", fields: LogFields) {
  const { error, ...rest } = fields
  const errorId =
    typeof rest.errorId === "string" ? rest.errorId : crypto.randomUUID()

  console.error(
    JSON.stringify({
      level: "ERROR",
      kind,
      errorId,
      timestamp: new Date().toISOString(),
      ...serializeError(error),
      ...rest,
    })
  )

  return errorId
}

export function logExpectedError(fields: LogFields) {
  return logError("expected", fields)
}

export function logUnexpectedError(fields: LogFields) {
  return logError("unexpected", fields)
}
