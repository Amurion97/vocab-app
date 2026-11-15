import { create } from "zustand"
import { Word } from "@prisma/client"

interface AddedWordsState {
  addedWords: Word[]
  addWord: (word: Word) => void
  removeWord: (word: Word) => void
  removeWords: (words: Word[]) => void
}

export const useAddedWordsStore = create<AddedWordsState>((set) => ({
  addedWords: [],
  addWord: (word: Word) =>
    set((state) => ({ addedWords: [...state.addedWords, word] })),
  removeWord: (word: Word) =>
    set((state) => ({
      addedWords: state.addedWords.filter((w) => w.id !== word.id),
    })),
  removeWords: (words: Word[]) =>
    set((state) => {
      let newWords = [...state.addedWords]
      words.forEach((word) => {
        newWords = newWords.filter((w) => w.id !== word.id)
      })
      return {
        addedWords: newWords,
      }
    }),
}))
