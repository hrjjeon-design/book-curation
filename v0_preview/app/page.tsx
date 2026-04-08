"use client"

import { useEffect, useState } from "react"
import { SearchInput } from "@/components/search-input"
import { TopicGroup } from "@/components/topic-group"
import { RecommendationResult } from "@/components/recommendation-result"
import { Skeleton } from "@/components/ui/skeleton"

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

  const handleSearch = (query: string) => {
    console.log("Search:", query)
    // TODO: Implement search recommendation
  }

  const handleTopicClick = async (themeId: string) => {
    setRecommending(true)
    try {
      const res = await fetch(`/api/recommend?themeId=${themeId}`)
      const data = await res.json()
      setRecommendation(data)
      window.scrollTo(0, 0)
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

  const groupedThemes = themes.reduce((acc: Record<string, Theme[]>, theme) => {
    if (!acc[theme.group]) acc[theme.group] = []
    acc[theme.group].push(theme)
    return acc
  }, {})

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

        {loading || recommending ? (
          <div className="space-y-8">
            <Skeleton className="h-4 w-[100px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
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
