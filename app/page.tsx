import { AddWordForm } from "@/components/add-word-form"
import { WordCard } from "@/components/word-card"
import { getWords } from "@/lib/words"

export default async function HomePage() {
  const words = await getWords()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-medium">Words</h1>
        <p className="text-sm text-muted-foreground">
          Save English words with Vietnamese translations, then review them by
          writing a usage sentence.
        </p>
      </div>
      <AddWordForm />
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-medium">
          Saved words ({words.length})
        </h2>
        {words.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No words yet. Add one above to start reviewing.
          </p>
        ) : (
          words.map((word) => <WordCard key={word.id} word={word} />)
        )}
      </section>
    </div>
  )
}
