"use client"

import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LoginRequiredProps {
  onLogin: () => void
}

export function LoginRequired({ onLogin }: LoginRequiredProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mb-6">
        <BookOpen className="w-10 h-10 text-muted-foreground/40" />
      </div>
      <h2 className="text-xl font-semibold mb-2">로그인이 필요합니다</h2>
      <p className="text-muted-foreground mb-8 text-balance">
        로그인하시면 지금까지 받은 추천 이력을<br />
        한곳에서 확인하실 수 있습니다.
      </p>
      <Button onClick={onLogin} className="flex items-center gap-2 px-8">
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Google로 로그인
      </Button>
    </div>
  )
}
