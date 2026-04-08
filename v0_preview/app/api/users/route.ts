import { db } from "@/lib/firebase/admin"

export async function POST(request: Request) {
  const { uid, email, displayName, photoURL, provider } = await request.json()

  if (!uid) {
    return Response.json({ error: "uid is required" }, { status: 400 })
  }

  const userRef = db.collection("users").doc(uid)
  const userDoc = await userRef.get()

  const now = new Date()

  if (!userDoc.exists) {
    await userRef.set({
      uid,
      email: email ?? null,
      displayName: displayName ?? null,
      photoURL: photoURL ?? null,
      provider: provider ?? "google.com",
      role: "user",
      status: "active",
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
  } else {
    await userRef.update({
      lastLoginAt: now,
      updatedAt: now,
    })
  }

  return Response.json({ status: "ok" })
}
