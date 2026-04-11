import { db } from "@/lib/firebase/admin"
import { geminiModel } from "@/lib/gemini"

let themeCache: any[] | null = null
let themeCacheTime = 0
const THEME_CACHE_TTL = 5 * 60 * 1000 // 5분

async function getAllActiveThemes() {
  const now = Date.now()
  if (themeCache && now - themeCacheTime < THEME_CACHE_TTL) {
    return themeCache
  }

  const snapshot = await db
    .collection("themes")
    .where("isActive", "==", true)
    .get()

  themeCache = snapshot.docs.map((doc) => ({
    themeId: doc.id,
    name: doc.data().name,
    description: doc.data().description,
    relatedConcepts: doc.data().relatedConcepts || [],
    exampleQueries: doc.data().exampleQueries || [],
    group: doc.data().group || "기타",
  }))
  themeCacheTime = now
  return themeCache
}

function sampleByGroup(themes: any[], limit: number): any[] {
  const groups: Record<string, any[]> = {}
  for (const t of themes) {
    const g = t.group || "기타"
    if (!groups[g]) groups[g] = []
    groups[g].push(t)
  }

  const groupNames = Object.keys(groups)
  const perGroup = Math.max(1, Math.floor(limit / groupNames.length))
  const result: any[] = []

  for (const g of groupNames) {
    const shuffled = groups[g].sort(() => Math.random() - 0.5)
    result.push(...shuffled.slice(0, perGroup))
  }

  return result.slice(0, limit)
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return Response.json({ error: "query is required" }, { status: 400 })
    }

    // 길이 제한 (프롬프트 인젝션 방지)
    const trimmedQuery = query.trim().slice(0, 200)
    if (trimmedQuery.length === 0) {
      return Response.json({ error: "query is required" }, { status: 400 })
    }

    // 1. 전체 활성 테마 가져오기 (캐시 사용)
    const allThemes = await getAllActiveThemes()

    // 2. 1차 필터: 키워드 매칭으로 후보 축소 (최대 30개)
    const queryLower = trimmedQuery.toLowerCase()
    const queryTokens = queryLower.split(/\s+/)

    const scored = allThemes.map((theme) => {
      let score = 0
      const searchText = [
        theme.name,
        theme.description,
        ...(theme.relatedConcepts || []),
        ...(theme.exampleQueries || []),
      ].join(" ").toLowerCase()

      for (const token of queryTokens) {
        if (token.length > 0 && searchText.includes(token)) score += 1
      }
      
      // name 직접 매칭은 가중치
      if (theme.name.toLowerCase().includes(queryLower)) score += 3

      return { ...theme, score }
    })

    // score > 0인 것만 취하되, 없으면 전체 중 샘플 30개
    let candidates = scored
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)

    if (candidates.length === 0) {
      // 키워드 매칭 실패 시 그룹별 균등 샘플링 (최대 30개)
      candidates = sampleByGroup(allThemes, 30)
    }

    // 3. 2차 필터: Gemini로 최종 3개 선택
    const themesForPrompt = candidates.map(({ themeId, name, description, relatedConcepts }) => ({
      themeId, name, description, relatedConcepts,
    }))

    const prompt = `
다음은 철학 도서 큐레이션 서비스의 주제 목록입니다:
${JSON.stringify(themesForPrompt, null, 2)}

사용자 입력:
"${trimmedQuery}"

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
      inputQuery: trimmedQuery,
      resolvedThemes: jsonResponse.resolvedThemes || [],
    })
  } catch (error) {
    console.error("Failed to route query:", error)
    return Response.json({ error: "Failed to route query" }, { status: 500 })
  }
}
