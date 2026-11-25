"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2Icon, Volume2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

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
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const trimmed = word.trim()
  const normalizedKey = trimmed.toLowerCase()

  const {
    data: cachedAudio,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["pronunciation", normalizedKey],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/pronunciation?word=${encodeURIComponent(trimmed)}`,
        { signal }
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
        return `data:${mime};base64,${data.audioBase64}`
      }
      return null
    },
    enabled: false,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: false,
  })

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
    if (!trimmed) {
      return
    }

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }
    const audio = audioRef.current

    if (cachedAudio) {
      playAudio(cachedAudio, trimmed)
      return
    }

    // Pre-unlock audio playback on iOS/WebKit within the direct user gesture
    // before the asynchronous fetch boundary expires user activation.
    audio.src = SILENT_AUDIO
    void audio.play().catch(() => {
      // Ignore silent audio prime rejection if any
    })

    try {
      const result = await refetch()
      if (result.data) {
        playAudio(result.data, trimmed)
      } else {
        // Quota exhausted or upstream failure: the user still hears the word.
        fallbackToSpeech(trimmed)
      }
    } catch {
      fallbackToSpeech(trimmed)
    }
  }, [trimmed, cachedAudio, playAudio, refetch, fallbackToSpeech])

  const inactive = disabled || isFetching || isPlaying || !trimmed

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
      {isFetching ? (
        <Loader2Icon className="animate-spin" aria-hidden />
      ) : (
        <Volume2Icon aria-hidden />
      )}
    </Button>
  )
}
