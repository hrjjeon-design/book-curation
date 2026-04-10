"use client"

import { useEffect, useState } from "react"
import { SearchInput } from "@/components/search-input"
import { TopicGroup } from "@/components/topic-group"
import { RecommendationResult } from "@/components/recommendation-result"
import { ThemeCandidatePanel } from "@/components/theme-candidate-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { auth } from "@/lib/firebase/client"
import { RefreshCw } from "lucide-react"

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
  const [refreshing, setRefreshing] = useState(false)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [recommending, setRecommending] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [seenBookIsbns, setSeenBookIsbns] = useState<string[]>([])
  const [currentThemeId, setCurrentThemeId] = useState<string | null>(null)

  // States for Stage 5
  const [freeQueryResult, setFreeQueryResult] = useState<{
    inputQuery: string
    resolvedThemes: { themeId: string; name: string; reason: string }[]
  } | null>(null)
  const [querying, setQuerying] = useState(false)
  const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)

  const fetchThemes = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    try {
      const res = await fetch("/api/themes")
      const data = await res.json()
      setThemes(data)
    } catch (err) {
      console.error("Failed to fetch themes", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchThemes()
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
    setRecommendation({ introMessage: "", books: [] })
    setSeenBookIsbns([])
    setCurrentThemeId(themeId)
    window.scrollTo(0, 0)

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
      if (!res.ok || !res.body) throw new Error("Stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let bookMeta: any[] = []
      let metaParsed = false

      // Helper for robust parsing
      const robustParse = (json: string) => {
        try {
          // Remove trailing commas in arrays and objects
          const cleaned = json.replace(/,(\s*[\]}])/g, "$1")
          return JSON.parse(cleaned)
        } catch (e) {
          throw e
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        // Extract metadata from first line
        if (!metaParsed && accumulated.includes("\n")) {
          const newlineIdx = accumulated.indexOf("\n")
          const metaLine = accumulated.slice(0, newlineIdx)
          try {
            const parsed = robustParse(metaLine)
            if (parsed.__meta__) {
              bookMeta = parsed.__meta__
              accumulated = accumulated.slice(newlineIdx + 1)
              metaParsed = true
            }
          } catch { }
        }

        if (!metaParsed) continue

        // Try to parse the Gemini JSON progressively
        const cleanedJson = accumulated.replace(/```json|```/g, "").trim()
        try {
          let jsonToParse = cleanedJson
          const startIdx = cleanedJson.indexOf("{")
          const endIdx = cleanedJson.lastIndexOf("}")
          
          if (startIdx !== -1 && endIdx !== -1) {
            jsonToParse = cleanedJson.substring(startIdx, endIdx + 1)
          } else {
             throw new Error("No JSON object found yet")
          }
          
          const parsed = robustParse(jsonToParse)
          const enrichedBooks = (Array.isArray(parsed.books) ? parsed.books : []).map((rec: any) => {
            const original = bookMeta.find((b: any) => b.title === rec.title)
            return {
              ...rec,
              bookId: original?.bookId || null,
              author: original?.author || rec.author || "Unknown",
              publisher: original?.publisher || null,
              pubYear: original?.pubYear || null,
              coverImage: original?.coverImage || null,
            }
          })
          setRecommendation({ introMessage: parsed.introMessage || "", books: enrichedBooks })
        } catch {
          // JSON not yet complete — try to extract partial data
          const introMatch = cleanedJson.match(/"introMessage"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (introMatch) {
            setRecommendation(prev => prev ? { ...prev, introMessage: introMatch[1] } : { introMessage: introMatch[1], books: [] })
          }
        }
      }

      // Final parse
      const cleanedJson = accumulated.replace(/```json|```/g, "").trim()
      let jsonToParse = cleanedJson
      const startIdx = cleanedJson.indexOf("{")
      const endIdx = cleanedJson.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1) {
        jsonToParse = cleanedJson.substring(startIdx, endIdx + 1)
      }
      
      try {
        const parsed = robustParse(jsonToParse)
        const finalBooks = (Array.isArray(parsed.books) ? parsed.books : []).map((rec: any) => {
          const original = bookMeta.find((b: any) => b.title === rec.title)
          return {
            ...rec,
            bookId: original?.bookId || null,
            author: original?.author || rec.author || "Unknown",
            publisher: original?.publisher || null,
            pubYear: original?.pubYear || null,
            coverImage: original?.coverImage || null,
          }
        })
        const finalData = { introMessage: parsed.introMessage || "", books: finalBooks }
        setRecommendation(finalData)
        // Track seen books for "show more" feature
        const newIsbns = finalBooks.map((b: any) => b.bookId).filter(Boolean)
        setSeenBookIsbns(prev => [...prev, ...newIsbns])

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
            recommendedBookIds: finalData.books?.map((b: any) => b.bookId).filter(Boolean) ?? [],
            deviceType: getDeviceType(),
          }),
        }).catch(err => console.error("Log failed", err))

        // Save history if logged in
        const user = auth.currentUser
        if (user && finalData.books?.length > 0) {
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
              recommendedBooks: finalData.books,
            }),
          })
        }
      } catch (finalErr) {
        console.error("Final JSON parse failed:", finalErr, jsonToParse)
        throw finalErr
      }
    } catch (err) {
      console.error("Failed to fetch recommendation", err)
      setRecommendation(null)
    } finally {
      setRecommending(false)
    }
  }

  const handleShowMore = async () => {
    if (!currentThemeId || loadingMore) return
    setLoadingMore(true)

    try {
      const excludeParam = seenBookIsbns.length > 0 ? `&excludeIsbns=${seenBookIsbns.join(",")}` : ""
      const res = await fetch(`/api/recommend?themeId=${currentThemeId}${excludeParam}`)
      if (!res.ok || !res.body) throw new Error("Stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      let bookMeta: any[] = []
      let metaParsed = false

      const robustParse = (json: string) => {
        const cleaned = json.replace(/,(\s*[\]}])/g, "$1")
        return JSON.parse(cleaned)
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })

        if (!metaParsed && accumulated.includes("\n")) {
          const newlineIdx = accumulated.indexOf("\n")
          const metaLine = accumulated.slice(0, newlineIdx)
          try {
            const parsed = robustParse(metaLine)
            if (parsed.__meta__) {
              bookMeta = parsed.__meta__
              accumulated = accumulated.slice(newlineIdx + 1)
              metaParsed = true
            }
          } catch { }
        }
      }

      // Parse the final result
      const cleanedJson = accumulated.replace(/```json|```/g, "").trim()
      let jsonToParse = cleanedJson
      const startIdx = cleanedJson.indexOf("{")
      const endIdx = cleanedJson.lastIndexOf("}")
      if (startIdx !== -1 && endIdx !== -1) {
        jsonToParse = cleanedJson.substring(startIdx, endIdx + 1)
      }

      const parsed = robustParse(jsonToParse)
      const newBooks = (Array.isArray(parsed.books) ? parsed.books : []).map((rec: any) => {
        const original = bookMeta.find((b: any) => b.title === rec.title)
        return {
          ...rec,
          bookId: original?.bookId || null,
          author: original?.author || rec.author || "Unknown",
          publisher: original?.publisher || null,
          pubYear: original?.pubYear || null,
          coverImage: original?.coverImage || null,
        }
      })

      if (newBooks.length > 0) {
        const newIsbns = newBooks.map((b: any) => b.bookId).filter(Boolean)
        setSeenBookIsbns(prev => [...prev, ...newIsbns])
        setRecommendation(prev => prev ? {
          ...prev,
          books: [...prev.books, ...newBooks],
        } : null)
      }
    } catch (err) {
      console.error("Failed to load more recommendations", err)
    } finally {
      setLoadingMore(false)
    }
  }

  if (recommendation) {
    return (
      <RecommendationResult
        introMessage={recommendation.introMessage}
        books={recommendation.books}
        streaming={recommending}
        loadingMore={loadingMore}
        onBack={() => { setRecommendation(null); setRecommending(false); setSeenBookIsbns([]); setCurrentThemeId(null) }}
        onShowMore={handleShowMore}
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
            <div className="space-y-3">
              <Skeleton className="h-5 w-24" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
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
          <div className={`space-y-10 sm:space-y-12 transition-opacity duration-300 ${refreshing ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {Object.entries(groupedThemes).map(([groupTitle, groupTopics]) => (
              <TopicGroup
                key={groupTitle}
                title={groupTitle}
                topics={groupTopics}
                onTopicClick={handleTopicClick}
              />
            ))}

            <div className="flex justify-center mt-6">
              <button
                onClick={() => fetchThemes(true)}
                disabled={refreshing}
                className="flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-card text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <RefreshCw className={`w-4 h-4 transition-transform ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 duration-500'}`} />
                다른 주제 보기
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
