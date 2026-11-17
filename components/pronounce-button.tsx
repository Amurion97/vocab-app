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

  const fallbackToSpeech = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    window.speechSynthesis.speak(utterance)
  }, [])

  const playAudio = useCallback(
    (src: string, fallbackWord: string) => {
      const audio = new Audio(src)
      setIsPlaying(true)
      const onEnded = () => setIsPlaying(false)
      const onError = () => {
        setIsPlaying(false)
        fallbackToSpeech(fallbackWord)
      }
      audio.addEventListener("ended", onEnded)
      audio.addEventListener("error", onError)
      void audio.play().catch(onError)
    },
    [fallbackToSpeech]
  )

  const onSpeak = useCallback(async () => {
    const trimmed = word.trim()
    if (!trimmed) {
      return
    }

    const cached = audioCache.get(trimmed.toLowerCase())
    if (cached) {
      playAudio(cached, trimmed)
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
        format?: string
      } | null
      if (response.ok && data?.ok && data.audioBase64) {
        const format = data.format || "mp3"
        const mime = format === "mp3" ? "audio/mp3" : `audio/${format}`
        const dataUrl = `data:${mime};base64,${data.audioBase64}`
        audioCache.set(trimmed.toLowerCase(), dataUrl)
        playAudio(dataUrl, trimmed)
      } else {
        // Quota exhausted or upstream failure: the user still hears the word.
        fallbackToSpeech(trimmed)
      }
    } catch {
      fallbackToSpeech(trimmed)
    } finally {
      setIsLoading(false)
    }
  }, [word, playAudio, fallbackToSpeech])

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
