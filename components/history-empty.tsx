"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HistoryEmpty() {
  return (
    <div className="p-12 text-center bg-muted/20 border border-dashed border-border rounded-xl animate-in fade-in duration-700">
      <p className="text-muted-foreground mb-6">
        아직 추천 이력이 없습니다.<br />
        다양한 철학 주제를 탐색해 보세요.
      </p>
      <Button variant="outline" asChild>
        <Link href="/">주제 둘러보기</Link>
      </Button>
    </div>
  )
}
