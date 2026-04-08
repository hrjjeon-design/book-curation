import { db } from "@/lib/firebase/admin"
import { geminiModel } from "@/lib/gemini"

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query) {
      return Response.json({ error: "query is required" }, { status: 400 })
    }

    // 1. Fetch active themes
    const themesSnapshot = await db
      .collection("themes")
      .where("isActive", "==", true)
      .get()

    const themes = themesSnapshot.docs.map((doc) => ({
      themeId: doc.id,
      name: doc.data().name,
      description: doc.data().description,
      relatedConcepts: doc.data().relatedConcepts,
      exampleQueries: doc.data().exampleQueries,
    }))

    // 2. Gemini Prompt
    const prompt = `
다음은 철학 도서 큐레이션 서비스의 주제 목록입니다:
${JSON.stringify(themes, null, 2)}

사용자 입력:
"${query}"

지침:
1. 위 주제 목록 중에서 사용자 입력과 가장 가까운 주제를 최대 3개 선택하세요.
2. 주제 목록에 없는 새 주제를 만들지 마세요.
3. 각 주제에 대해 이 입력과 연결되는 이유를 한 문장으로 작성하세요.

응답은 반드시 JSON 형식으로만 보내주세요:
{
  "resolvedThemes": [
    { "themeId": "...", "name": "...", "reason": "..." }
  ]
}
`

    const result = await geminiModel.generateContent(prompt)
    const responseText = result.response.text()
    
    // Parse JSON safely
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    let jsonResponse = { resolvedThemes: [] }
    
    if (jsonMatch) {
      try {
        jsonResponse = JSON.parse(jsonMatch[0])
      } catch (e) {
        console.error("Failed to parse Gemini response as JSON:", responseText)
      }
    }

    return Response.json({
      inputQuery: query,
      resolvedThemes: jsonResponse.resolvedThemes || [],
    })
  } catch (error) {
    console.error("Failed to route query:", error)
    return Response.json({ error: "Failed to route query" }, { status: 500 })
  }
}
