"use client"

import { useCallback, useState } from "react"
import { Loader2Icon, Volume2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

// Module-level cache so repeating a word in the same session never triggers a
// duplicate network request (and never burns more of the daily API quota).
const audioCache = new Map<string, string>()

type PronounceButtonProps = {
  word: string
  disabled?: boolean
  size?: "default" | "sm" | "icon"
  className?: string
}

export function PronounceButton({
  word,
  disabled = false,
  size = "icon",
  className,
}: PronounceButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const playBase64 = useCallback((base64: string) => {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`)
    setIsPlaying(true)
    audio.addEventListener("ended", () => setIsPlaying(false))
    audio.addEventListener("error", () => setIsPlaying(false))
    void audio.play().catch(() => setIsPlaying(false))
  }, [])

  const fallbackToSpeech = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    window.speechSynthesis.speak(utterance)
  }, [])

  const onSpeak = useCallback(async () => {
    const trimmed = word.trim()
    if (!trimmed) {
      return
    }

    const cached = audioCache.get(trimmed.toLowerCase())
    if (cached) {
      playBase64(cached)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/pronunciation?word=${encodeURIComponent(trimmed)}`
      )
      const data = (await response.json().catch(() => null)) as {
        ok: boolean
        audioBase64?: string
      } | null
      if (response.ok && data?.ok && data.audioBase64) {
        audioCache.set(trimmed.toLowerCase(), data.audioBase64)
        playBase64(data.audioBase64)
      } else {
        // Quota exhausted or upstream failure: the user still hears the word.
        fallbackToSpeech(trimmed)
      }
    } catch {
      fallbackToSpeech(trimmed)
    } finally {
      setIsLoading(false)
    }
  }, [word, playBase64, fallbackToSpeech])

  const inactive = disabled || isLoading || isPlaying || !word.trim()

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={className}
      disabled={inactive}
      onClick={() => void onSpeak()}
      aria-label="Listen to pronunciation"
    >
      {isLoading ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <Volume2Icon aria-hidden />
      )}
    </Button>
  )
}
