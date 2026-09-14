"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-heading text-sm font-medium">
          Vocab
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/"
            className={buttonVariants({
              variant: pathname === "/" ? "default" : "ghost",
              size: "sm",
            })}
          >
            Words
          </Link>
          <Link
            href="/review"
            className={buttonVariants({
              variant: pathname === "/review" ? "default" : "ghost",
              size: "sm",
            })}
          >
            Review
          </Link>
        </nav>
      </div>
    </header>
  )
}
