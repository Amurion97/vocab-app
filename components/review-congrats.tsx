import Link from "next/link"
import type { Word } from "@prisma/client"

import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ReviewCongrats({ word }: { word: Word }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All caught up on this word</CardTitle>
        <CardDescription>
          You already practised <strong>{word.english}</strong> today.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Come back tomorrow for the next nudge, or keep going with another
          word.
        </p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 sm:flex-row">
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Add a word
        </Link>
        <Link
          href={`/review?after=${word.id}`}
          className={buttonVariants({ variant: "default" })}
        >
          Review another word
        </Link>
      </CardFooter>
    </Card>
  )
}
