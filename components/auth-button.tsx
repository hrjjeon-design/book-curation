"use client"

import { useEffect, useState } from "react"
import { User } from "firebase/auth"
import { signInWithGoogle, signOutUser, onAuthChange } from "@/lib/auth"

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => {
      setUser(u)
      setLoading(false)
      if (u) {
        fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName,
            photoURL: u.photoURL,
            provider: "google.com",
          }),
        })
      }
    })
    return () => unsubscribe()
  }, [])

  if (loading) return null

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.photoURL && (
          <img
            src={user.photoURL}
            alt={user.displayName ?? ""}
            className="w-7 h-7 rounded-full"
          />
        )}
        <span className="text-sm text-muted-foreground hidden sm:block">
          {user.displayName}
        </span>
        <button
          onClick={() => signOutUser()}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => signInWithGoogle()}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      Google로 로그인
    </button>
  )
}
