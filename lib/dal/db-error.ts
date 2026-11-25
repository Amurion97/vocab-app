type PrismaLikeError = {
  code?: string
  message?: string
}

export function prismaErrorMessage(error: unknown, fallback: string) {
  console.error(fallback, error)

  const prismaError = error as PrismaLikeError
  if (prismaError.code === "P2002") {
    return "That English word is already saved."
  }
  if (prismaError.code === "P1001" || prismaError.code === "P2024") {
    return "Database is waking up or busy. Try saving again."
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}

export function isUniqueConstraint(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  )
}
