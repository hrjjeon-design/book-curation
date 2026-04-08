"use client"

import { useEffect, useState } from "react"
import { SearchInput } from "@/components/search-input"
import { TopicGroup } from "@/components/topic-group"
import { RecommendationResult } from "@/components/recommendation-result"
import { ThemeCandidatePanel } from "@/components/theme-candidate-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { auth } from "@/lib/firebase/client"

interface Theme {
  themeId: string
  name: string
  group: string
}

interface Recommendation {
  introMessage: string
  books: any[]
}

export default function Home() {
  const [themes, setThemes] = useState<Theme[]>([])
  const [loading, setLoading] = useState(true)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [recommending, setRecommending] = useState(false)
  
  // States for Stage 5
  const [freeQueryResult, setFreeQueryResult] = useState<{
    inputQuery: string
    resolvedThemes: { themeId: string; name: string; reason: string }[]
  } | null>(null)
  const [querying, setQuerying] = useState(false)
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

  useEffect(() => {
    fetch("/api/themes")
      .then((res) => res.json())
      .then((data) => {
        setThemes(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch themes", err)
        setLoading(false)
      })
  }, [])

  const getDeviceType = (): string => {
    if (typeof window === "undefined") return "desktop"
    const w = window.innerWidth
    if (w < 768) return "mobile"
    if (w < 1024) return "tablet"
    return "desktop"
  }

  const handleSearch = async (query: string) => {
    if (!query.trim()) return
    setQuerying(true)
    try {
      // 1. interaction_logs: free_query_submitted (fire-and-forget)
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: auth.currentUser?.uid ?? null,
          eventType: "free_query_submitted",
          entryType: "free_input",
          themeId: null,
          resolvedThemeIds: [],
          inputQuery: query,
          recommendedBookIds: [],
          deviceType: getDeviceType(),
        }),
      }).catch(err => console.error("Log failed", err))

      // 2. /api/route-query 호출
      const res = await fetch("/api/route-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      setFreeQueryResult(data)
      setRecommendation(null) // Clear any existing recommendation
      window.scrollTo(0, 0)
    } catch (err) {
      console.error("Failed to route query", err)
    } finally {
      setQuerying(false)
    }
  }

  const handleTopicClick = async (themeId: string) => {
    setRecommending(true)
    
    const entryType = freeQueryResult ? "free_input" : "theme_selection"
    
    // interaction_logs: theme_selected (fire-and-forget)
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userId: auth.currentUser?.uid ?? null,
        eventType: "theme_selected",
        entryType,
        themeId: themeId,
        resolvedThemeIds: [themeId],
        inputQuery: freeQueryResult?.inputQuery ?? null,
        recommendedBookIds: [],
        deviceType: getDeviceType(),
      }),
    }).catch(err => console.error("Log failed", err))

    try {
      const res = await fetch(`/api/recommend?themeId=${themeId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRecommendation(data)
      window.scrollTo(0, 0)

      // interaction_logs: recommendation_rendered (fire-and-forget)
      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userId: auth.currentUser?.uid ?? null,
          eventType: "recommendation_rendered",
          entryType,
          themeId: themeId,
          resolvedThemeIds: [themeId],
          inputQuery: freeQueryResult?.inputQuery ?? null,
          recommendedBookIds: data.books?.map((b: any) => b.bookId).filter(Boolean) ?? [],
          deviceType: getDeviceType(),
        }),
      }).catch(err => console.error("Log failed", err))

      // Save history if logged in
      const user = auth.currentUser
      if (user && data.books?.length > 0) {
        fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: user.uid,
            entryType,
            inputQuery: freeQueryResult?.inputQuery ?? null,
            selectedThemeId: themeId,
            selectedThemeLabel: themes.find((t) => t.themeId === themeId)?.name ?? "",
            resolvedThemeIds: [themeId],
            resolvedThemeLabels: [themes.find((t) => t.themeId === themeId)?.name ?? ""],
            recommendedBooks: data.books,
          }),
        })
      }
    } catch (err) {
      console.error("Failed to fetch recommendation", err)
    } finally {
      setRecommending(false)
    }
  }

  if (recommendation) {
    return (
      <RecommendationResult
        introMessage={recommendation.introMessage}
        books={recommendation.books}
        onBack={() => setRecommendation(null)}
      />
    )
  }

  const groupedThemes = Array.isArray(themes) ? themes.reduce((acc: Record<string, Theme[]>, theme) => {
    if (!acc[theme.group]) acc[theme.group] = []
    acc[theme.group].push(theme)
    return acc
  }, {}) : {}

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        <header className="text-center mb-10 sm:mb-12">
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight text-balance">
            철학 도서 큐레이션
          </h1>
          <p className="mt-3 text-muted-foreground text-base sm:text-lg">
            삶의 질문에 맞는 철학 도서를 찾아드립니다
          </p>
        </header>

        <div className="mb-12 sm:mb-16">
          <SearchInput onSearch={handleSearch} />
        </div>

        {loading || recommending || querying ? (
          <div className="space-y-8">
            <Skeleton className="h-4 w-[100px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        ) : freeQueryResult ? (
          <ThemeCandidatePanel
            inputQuery={freeQueryResult.inputQuery}
            resolvedThemes={freeQueryResult.resolvedThemes}
            onSelect={handleTopicClick}
            onBack={() => setFreeQueryResult(null)}
          />
        ) : (
          <div className="space-y-10 sm:space-y-12">
            {Object.entries(groupedThemes).map(([groupTitle, groupTopics]) => (
              <TopicGroup
                key={groupTitle}
                title={groupTitle}
                topics={groupTopics}
                onTopicClick={handleTopicClick}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
