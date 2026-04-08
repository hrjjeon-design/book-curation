import { db } from "@/lib/firebase/admin"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, userId, eventType, entryType, themeId, resolvedThemeIds, inputQuery, recommendedBookIds, deviceType } = body

    if (!sessionId || !eventType || !entryType || !deviceType) {
      return Response.json({ error: "Required fields are missing" }, { status: 400 })
    }

    const logRef = db.collection("interaction_logs").doc()
    const now = new Date()

    const logData = {
      eventId: logRef.id,
      sessionId,
      userId: userId ?? null,
      eventType,
      entryType,
      themeId: themeId ?? null,
      resolvedThemeIds: resolvedThemeIds ?? [],
      inputQuery: inputQuery ?? null,
      recommendedBookIds: recommendedBookIds ?? [],
      deviceType,
      selectedBookId: null,
      isReturnVisit: false,
      createdAt: now,
    }

    await logRef.set(logData)

    return Response.json({ status: "ok", eventId: logRef.id })
  } catch (error) {
    console.error("Failed to save interaction log:", error)
    return Response.json({ error: "Failed to save log" }, { status: 500 })
  }
}
