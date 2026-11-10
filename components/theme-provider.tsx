"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      <ThemeHotkey />
      {children}
    </NextThemesProvider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  )
}

function nextTheme(theme: string | undefined) {
  if (theme === "light") {
    return "dark"
  }

  if (theme === "dark") {
    return "system"
  }

  return "light"
}

function themeAnnouncement(theme: string) {
  if (theme === "dark") {
    return "Dark theme"
  }

  if (theme === "system") {
    return "System theme"
  }

  return "Light theme"
}

function isMenuTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      "[role='menu'], [role='menuitem'], [role='menuitemradio'], [role='menuitemcheckbox']"
    )
  )
}

function ThemeHotkey() {
  const { theme, setTheme } = useTheme()
  const [announcement, setAnnouncement] = React.useState("")

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (event.key.toLowerCase() !== "d") {
        return
      }

      // D cycles Light → Dark → System. Skip it inside the open menu so
      // letter navigation can still reach the Dark item.
      if (isTypingTarget(event.target) || isMenuTarget(event.target)) {
        return
      }

      const next = nextTheme(theme)
      setTheme(next)
      setAnnouncement(themeAnnouncement(next))
    }

    window.addEventListener("keydown", onKeyDown)

    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [theme, setTheme])

  return (
    <span className="sr-only" aria-live="polite">
      {announcement}
    </span>
  )
}

export { ThemeProvider }
