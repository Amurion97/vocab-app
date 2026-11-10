"use client"

import { Menu } from "@base-ui/react/menu"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import * as React from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "cn"

const THEME_OPTIONS = [
  { value: "light", label: "Light", hint: null, Icon: SunIcon },
  { value: "dark", label: "Dark", hint: null, Icon: MoonIcon },
  {
    value: "system",
    label: "System",
    hint: "Follows this device",
    Icon: MonitorIcon,
  },
] as const

type ThemeChoice = (typeof THEME_OPTIONS)[number]["value"]

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system"
}

function useClientReady() {
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    // localStorage is already readable on the client during hydration, so the
    // first render has to ignore it. This flip happens after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration gate
    setReady(true)
  }, [])

  return ready
}

function themeButtonLabel(theme: string | undefined) {
  if (!isThemeChoice(theme)) {
    return "Theme"
  }

  if (theme === "system") {
    return "Theme: System, follows this device"
  }

  if (theme === "dark") {
    return "Theme: Dark"
  }

  return "Theme: Light"
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = React.useState(false)
  const ready = useClientReady()
  const shownTheme = ready && isThemeChoice(theme) ? theme : undefined
  const selected = shownTheme ?? ""

  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "size-11 data-popup-open:bg-muted"
        )}
        aria-expanded={open}
        aria-label={shownTheme ? themeButtonLabel(shownTheme) : undefined}
      >
        <ThemeIcon theme={shownTheme} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
        >
          <Menu.Popup
            className={cn(
              "w-56 origin-(--transform-origin) rounded-xl bg-popover p-1 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
              "motion-reduce:animate-none"
            )}
          >
            <Menu.RadioGroup
              value={selected}
              onValueChange={(value) => {
                if (isThemeChoice(value)) {
                  setTheme(value)
                }
              }}
            >
              {THEME_OPTIONS.map(({ value, label, hint, Icon }) => (
                <Menu.RadioItem
                  key={value}
                  value={value}
                  closeOnClick
                  className="flex min-h-11 cursor-default items-center gap-2 rounded-lg px-2.5 outline-none select-none focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-checked:bg-muted"
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col items-start">
                    <span>{label}</span>
                    {hint ? (
                      <span className="text-xs text-muted-foreground">
                        {hint}
                      </span>
                    ) : null}
                  </span>
                  <span className="ml-auto size-4">
                    <Menu.RadioItemIndicator>
                      <CheckIcon className="size-4" aria-hidden />
                    </Menu.RadioItemIndicator>
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}

function ThemeIcon({ theme }: { theme: string | undefined }) {
  if (theme === "system") {
    return <MonitorIcon className="size-4" aria-hidden />
  }

  if (theme === "light") {
    return <SunIcon className="size-4" aria-hidden />
  }

  if (theme === "dark") {
    return <MoonIcon className="size-4" aria-hidden />
  }

  return (
    <span className="relative size-4">
      <SunIcon className="absolute inset-0 size-4 scale-100 dark:scale-0" />
      <MoonIcon className="absolute inset-0 size-4 scale-0 dark:scale-100" />
      {/* The name swaps in CSS, like the icons above, so it needs no client
          state to stay in sync with the .dark class next-themes sets. */}
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:block">Switch to light theme</span>
    </span>
  )
}
