"use client"

import { BookOpen, Play } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface HistoryCardProps {
  historyId: string
  entryType: "theme_selection" | "free_input"
  inputQuery: string | null
  selectedThemeLabel: string | null
  selectedThemeId?: string | null
  recommendedBooks: { title: string; author: string }[]
  createdAt: string // ISO string
  onReplay?: (themeId: string) => void
}

export function HistoryCard({
  entryType,
  inputQuery,
  selectedThemeLabel,
  selectedThemeId,
  recommendedBooks,
  createdAt,
  onReplay,
}: HistoryCardProps) {
  const date = new Date(createdAt)
  const now = new Date()
  const formattedDate = date.getFullYear() === now.getFullYear()
    ? `${date.getMonth() + 1}월 ${date.getDate()}일`
    : `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`

  return (
    <div className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{formattedDate}</span>
          <div className="text-sm">
            <span className="text-muted-foreground">
              {entryType === "theme_selection" ? "주제 선택" : "자유 검색"} ·{" "}
            </span>
            <span className="font-medium text-foreground">
              {selectedThemeLabel || "선택된 주제 없음"}
            </span>
          </div>
          {entryType === "free_input" && inputQuery && (
            <div className="text-xs text-muted-foreground mt-1 italic">
              &quot;{inputQuery}&quot; 검색 결과 기반
            </div>
          )}
        </div>
        {selectedThemeId && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onReplay?.(selectedThemeId)}
            className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            title="다시 추천받기"
          >
            <Play className="w-4 h-4 fill-current" />
          </Button>
        )}
      </div>

      <div className="space-y-2 pt-2 border-t border-border/50">
        {recommendedBooks.slice(0, 3).map((book, idx) => (
          <div key={idx} className="flex items-center gap-3 text-sm text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-foreground/80">{book.title}</span>
            <span className="hidden sm:inline text-xs opacity-60">· {book.author}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
