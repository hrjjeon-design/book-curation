import { db } from "@/lib/firebase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const themesSnapshot = await db
      .collection("themes")
      .where("isActive", "==", true)
      .orderBy("priorityOrder", "asc")
      .get()

    const themes = themesSnapshot.docs.map((doc: any) => ({
      ...doc.data(),
    }))

    return Response.json(themes)
  } catch (error) {
    console.error("Error fetching themes:", error)
    return Response.json({ error: "Failed to fetch themes" }, { status: 500 })
  }
}
