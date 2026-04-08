import { db } from "@/lib/firebase/admin"
import { geminiModel } from "@/lib/gemini"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const themeId = searchParams.get("themeId")

  if (!themeId) {
    return Response.json({ error: "themeId is required" }, { status: 400 })
  }

  try {
    // 1. Fetch data from Firestore
    const [themeDoc, curatorDoc, booksSnapshot] = await Promise.all([
      db.collection("themes").doc(themeId).get(),
      db.collection("curator_config").doc("default_curator").get(),
      db.collection("books").where("isActive", "==", true).get(),
    ])

    if (!themeDoc.exists || !curatorDoc.exists) {
      return Response.json({ error: "Theme or Curator Config not found" }, { status: 404 })
    }

    const theme = themeDoc.data()!
    const curator = curatorDoc.data()!
    const allBooks = booksSnapshot.docs.map((doc: any) => ({
      bookId: doc.id,
      ...doc.data()
    }))

    // 2. Filter books by themeHints
    const filteredBooks = allBooks.filter((book: any) =>
      book.themeHints?.includes(themeId)
    )

    // 3. Prepare Prompt for Gemini
    const prompt = `
당신은 다음과 같은 페르소나를 가진 도서 큐레이터입니다:
이름: ${curator.name}
설명: ${curator.summary}
말투: ${curator.voiceStyle.join(", ")}

사용자가 다음 주제에 대해 질문하거나 책 추천을 원합니다:
주제: ${theme.name} (${theme.description})

추천할 후보 도서 목록:
${JSON.stringify(filteredBooks.map((b: any) => ({
  title: b.title,
  author: b.author,
  description: b.descriptionRaw
})), null, 2)}

지침:
1. 후보 도서들 중에서 주제에 가장 적합한 책을 선정하세요. (최대 3권)
2. 각 책에 대해 다음 정보를 작성하세요:
   - oneLineSummary: 책에 대한 한 줄 요약
   - entryDifficulty: 입문, 중간, 어려움 중 하나
   - philosophicalContext: 이 책이 다루는 철학적 맥락
   - whyThisBook: 이 사용자의 상황/주제에 이 책이 추천되는 이유
   - reasonTags: 짧은 태그 목록 (예: #실존주의, #불안)
3. 전체 추천에 대한 짧은 도입 메시지(introMessage)를 포함하세요.

응답은 반드시 JSON 형식으로만 보내주세요:
{
  "introMessage": "...",
  "books": [
    {
      "title": "...",
      "oneLineSummary": "...",
      "entryDifficulty": "입문",
      "philosophicalContext": "...",
      "whyThisBook": "...",
      "reasonTags": ["#...", "#..."]
    },
    ...
  ]
}
`

    // 4. Book metadata for client-side enrichment
    const bookMeta = allBooks.map((b: any) => ({
      bookId: b.bookId,
      title: b.title,
      author: b.author,
      publisher: b.publisher || null,
      pubYear: b.pubYear || null,
      coverImage: b.coverImage || null,
    }))

    // 5. Stream Gemini response
    const result = await geminiModel.generateContentStream(prompt)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send book metadata as first line
        controller.enqueue(encoder.encode(JSON.stringify({ __meta__: bookMeta }) + "\n"))

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(text))
          }
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    })

  } catch (error: any) {
    console.error("Recommendation error:", error)
    return Response.json({
      error: "Failed to generate recommendation",
      details: error.message || String(error)
    }, { status: 500 })
  }
}
