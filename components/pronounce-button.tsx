"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2Icon, Volume2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

// Module-level cache so repeating a word in the same session never triggers a
// duplicate network request (and never burns more of the daily API quota).
const audioCache = new Map<string, string>()

// 1-sample silent WAV data URI to unlock audio on iOS/WebKit within a user gesture.
const SILENT_AUDIO =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

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
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const fallbackToSpeech = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return
    }
    try {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "en-US"
      // Retain active utterance on window to prevent premature garbage collection in iOS Safari.
      const winWithUtterance = window as unknown as {
        __activeUtterance?: SpeechSynthesisUtterance | null
      }
      winWithUtterance.__activeUtterance = utterance
      utterance.onend = () => {
        winWithUtterance.__activeUtterance = null
      }
      utterance.onerror = () => {
        winWithUtterance.__activeUtterance = null
      }
      window.speechSynthesis.speak(utterance)
    } catch {
      // Ignore speech synthesis failures
    }
  }, [])

  const playAudio = useCallback(
    (src: string, fallbackWord: string) => {
      if (!audioRef.current) {
        audioRef.current = new Audio()
      }
      const audio = audioRef.current
      audio.pause()
      audio.src = src
      audio.currentTime = 0

      setIsPlaying(true)
      const onEnded = () => {
        setIsPlaying(false)
        audio.removeEventListener("ended", onEnded)
        audio.removeEventListener("error", onError)
      }
      const onError = () => {
        setIsPlaying(false)
        audio.removeEventListener("ended", onEnded)
        audio.removeEventListener("error", onError)
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

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    const audio = audioRef.current

    const cached = audioCache.get(trimmed.toLowerCase())
    if (cached) {
      playAudio(cached, trimmed)
      return
    }

    // Pre-unlock audio playback on iOS/WebKit within the direct user gesture
    // before the asynchronous fetch boundary expires user activation.
    audio.src = SILENT_AUDIO
    void audio.play().catch(() => {
      // Ignore silent audio prime rejection if any
    })

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
        // RFC standard MIME type for MP3 is audio/mpeg. WebKit/Safari strictly
        // rejects data:audio/mp3 with MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED.
        const mime =
          format.toLowerCase() === "mp3" ? "audio/mpeg" : `audio/${format}`
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
