"use client"

import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ThemeCandidate {
  themeId: string
  name: string
  reason: string
}

interface ThemeCandidatePanelProps {
  inputQuery: string
  resolvedThemes: ThemeCandidate[]
  onSelect: (themeId: string) => void
  onBack: () => void
}

export function ThemeCandidatePanel({
  inputQuery,
  resolvedThemes,
  onSelect,
  onBack,
}: ThemeCandidatePanelProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="space-y-2">
        <h2 className="text-xl font-medium text-foreground tracking-tight">
          &quot;{inputQuery}&quot;에 대한 추천 주제
        </h2>
        <p className="text-sm text-muted-foreground">
          관심 있는 주제를 선택하시면 맞춤 도서를 추천해 드립니다.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {resolvedThemes.length > 0 ? (
          resolvedThemes.map((theme) => (
            <button
              key={theme.themeId}
              onClick={() => onSelect(theme.themeId)}
              className="w-full text-left p-4 bg-card border border-border rounded-lg hover:border-primary/40 hover:bg-muted/30 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {theme.name}
              </div>
              <div className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {theme.reason}
              </div>
            </button>
          ))
        ) : (
          <div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">관련 주제를 찾지 못했습니다. 다른 질문을 입력해 보세요.</p>
          </div>
        )}
      </div>

      <div className="pt-4">
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          다시 검색
        </Button>
      </div>
    </div>
  )
}
