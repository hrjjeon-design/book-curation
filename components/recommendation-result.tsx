"use client"

import { ArrowLeft, Loader2 } from "lucide-react"
import { BookCard } from "@/components/book-card"

interface Book {
  bookId: string | null
  title: string
  author: string
  publisher: string | null
  pubYear: number | null
  coverImage: string | null
  oneLineSummary: string
  entryDifficulty: "입문" | "중간" | "어려움"
  philosophicalContext: string
  whyThisBook: string
  reasonTags: string[]
}

interface RecommendationResultProps {
  introMessage: string
  books: Book[]
  streaming?: boolean
  onBack: () => void
}

export function RecommendationResult({ introMessage, books, streaming, onBack }: RecommendationResultProps) {
  return (
    <div className="max-w-2xl mx-auto px-5 py-8">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        주제 선택으로 돌아가기
      </button>

      {introMessage ? (
        <div className="border-l-2 border-primary pl-4 mb-8">
          <p className="text-muted-foreground text-sm leading-relaxed">{introMessage}</p>
        </div>
      ) : streaming ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          추천 도서를 선정하고 있습니다...
        </div>
      ) : null}

      <div className="divide-y divide-border">
        {Array.isArray(books) && books.map((book, i) => (
          <BookCard
            key={book.bookId ?? i}
            title={book.title}
            author={book.author}
            publisher={book.publisher}
            pubYear={book.pubYear}
            coverImage={book.coverImage}
            oneLineSummary={book.oneLineSummary}
            entryDifficulty={book.entryDifficulty}
            philosophicalContext={book.philosophicalContext}
            whyThisBook={book.whyThisBook}
            reasonTags={book.reasonTags}
          />
        ))}
      </div>

      {streaming && books.length > 0 && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          더 찾고 있습니다...
        </div>
      )}
    </div>
  )
}
