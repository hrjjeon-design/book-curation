"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User } from "firebase/auth"
import { onAuthChange, signInWithGoogle } from "@/lib/auth"
import { LoginRequired } from "@/components/login-required"
import { HistoryEmpty } from "@/components/history-empty"
import { HistoryCard } from "@/components/history-card"
import { Loader2 } from "lucide-react"

interface HistoryItem {
  historyId: string
  entryType: "theme_selection" | "free_input"
  inputQuery: string | null
  selectedThemeId: string | null
  selectedThemeLabel: string | null
  recommendedBooks: { title: string; author: string }[]
  createdAt: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        fetchHistory(currentUser.uid)
      } else {
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  const fetchHistory = async (uid: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/history?uid=${uid}`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data.history || [])
      }
    } catch (err) {
      console.error("Failed to fetch history:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleReplay = (themeId: string) => {
    router.push(`/?themeId=${themeId}`)
  }

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !user ? (
        <LoginRequired onLogin={() => signInWithGoogle()} />
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-10">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
              내 추천 이력
            </h1>
            {history.length > 0 && (
              <p className="text-sm text-muted-foreground">
                지금까지 {history.length}번의 추천을 받았습니다
              </p>
            )}
          </div>

          {history.length === 0 ? (
            <HistoryEmpty />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {history.map((item) => (
                <HistoryCard
                  key={item.historyId}
                  {...item}
                  onReplay={handleReplay}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
