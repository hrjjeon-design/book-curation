import { db } from "@/lib/firebase/admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const uid = searchParams.get("uid")

  if (!uid) {
    return Response.json({ error: "uid is required" }, { status: 400 })
  }

  const snapshot = await db
    .collection("users")
    .doc(uid)
    .collection("recommendation_history")
    .orderBy("createdAt", "desc")
    .limit(20)
    .get()

  const history = snapshot.docs.map((doc) => ({
    historyId: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString(),
  }))

  return Response.json({ history })
}

export async function POST(request: Request) {
  const body = await request.json()
  const { uid, entryType, inputQuery, selectedThemeId, selectedThemeLabel,
          resolvedThemeIds, resolvedThemeLabels, recommendedBooks } = body

  if (!uid) {
    return Response.json({ error: "uid is required" }, { status: 400 })
  }

  const now = new Date()
  const ref = db
    .collection("users")
    .doc(uid)
    .collection("recommendation_history")
    .doc()

  await ref.set({
    historyId: ref.id,
    userId: uid,
    entryType: entryType ?? "theme_selection",
    inputQuery: inputQuery ?? null,
    selectedThemeId: selectedThemeId ?? null,
    selectedThemeLabel: selectedThemeLabel ?? null,
    resolvedThemeIds: resolvedThemeIds ?? [],
    resolvedThemeLabels: resolvedThemeLabels ?? [],
    recommendedBooks: recommendedBooks ?? [],
    createdAt: now,
    updatedAt: now,
  })

  return Response.json({ status: "ok", historyId: ref.id })
}
