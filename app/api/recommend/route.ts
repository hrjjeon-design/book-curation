import { db } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { geminiModel } from "@/lib/gemini"
import { GeminiCandidate, verifyBooks } from "@/lib/nl-api"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const themeId = searchParams.get("themeId")

  if (!themeId) {
    return Response.json({ error: "themeId is required" }, { status: 400 })
  }

  try {
    // 1. Fetch data from Firestore
    const [themeDoc, curatorDoc] = await Promise.all([
      db.collection("themes").doc(themeId).get(),
      db.collection("curator_config").doc("default_curator").get(),
    ])

    if (!themeDoc.exists || !curatorDoc.exists) {
      return Response.json({ error: "Theme or Curator Config not found" }, { status: 404 })
    }

    const theme = themeDoc.data()!
    const curator = curatorDoc.data()!

    // --- STEP 1: Gemini Candidate Generation ---
    const step1Prompt = `
당신은 한국어 철학 도서 전문가입니다.

다음 주제에 대해 추천할 만한 한국어 철학 도서 후보를 10권 제시하세요:
주제: ${theme.name} (${theme.description})
관련 개념: ${theme.relatedConcepts?.join(", ") || ""}

지침:
1. 한국에서 출판된 철학 도서만 추천하세요 (번역서 포함)
2. 실제 존재하는 책만 추천하세요. 제목이나 저자를 지어내지 마세요.
3. ISBN을 아는 경우 포함하세요.

응답은 반드시 JSON 배열로만 보내주세요:
[
  { "title": "...", "author": "...", "isbn": "..." },
  ...
]
`
    const step1Result = await geminiModel.generateContent(step1Prompt)
    const step1Text = step1Result.response.text()
    let candidates: GeminiCandidate[] = []
    try {
      // Clean potential markdown code blocks
      const cleanedJson = step1Text.replace(/```json|```/g, "").trim()
      candidates = JSON.parse(cleanedJson)
    } catch (e) {
      console.error("Step 1 JSON Parse Error:", e, step1Text)
      throw new Error("Failed to parse candidate list")
    }

    // --- STEP 2: National Library of Korea Verification ---
    const verifiedBooks = await verifyBooks(candidates)

    if (verifiedBooks.length === 0) {
      return Response.json({ error: "No verified books found for this theme" }, { status: 404 })
    }

    // --- STEP 3: Gemini Final Recommendation (Streaming) ---
    const step3Prompt = `
당신은 다음과 같은 페르소나를 가진 도서 큐레이터입니다:
이름: ${curator.name}
설명: ${curator.summary}
말투: ${curator.voiceStyle.join(", ")}

사용자가 다음 주제에 대해 책 추천을 원합니다:
주제: ${theme.name} (${theme.description})

추천할 후보 도서 목록:
${JSON.stringify(verifiedBooks, null, 2)}

지침:
1. 후보 도서들 중에서 주제에 가장 적합한 책을 선정하세요. (최대 3권)
2. 후보 목록에 없는 책은 절대 추천하지 마세요.
3. 각 책에 대해 다음 정보를 작성하세요:
   - title: 책 제목 (후보 목록과 동일하게)
   - oneLineSummary: 책에 대한 한 줄 요약
   - entryDifficulty: 입문, 중간, 어려움 중 하나
   - philosophicalContext: 이 책이 다루는 철학적 맥락
   - whyThisBook: 이 주제에 이 책이 추천되는 이유
   - reasonTags: 짧은 태그 목록 (예: #실존주의, #불안)
4. 전체 추천에 대한 짧은 도입 메시지(introMessage)를 포함하세요.

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
    }
  ]
}
`

    const result = await geminiModel.generateContentStream(step3Prompt)
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        // Send book metadata as first line
        const bookMeta = verifiedBooks.map((b: any) => ({
          bookId: b.isbn, // Use ISBN as bookId
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          pubYear: b.pubYear,
          coverImage: b.coverImage,
        }))
        controller.enqueue(encoder.encode(JSON.stringify({ __meta__: bookMeta }) + "\n"))

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            controller.enqueue(encoder.encode(text))
          }
        }

        // --- STEP 4: Store in Firestore (Fire-and-forget) ---
        // This runs after the stream starts/finishes or in parallel but we'll do it async here
        (async () => {
          try {
            for (const book of verifiedBooks) {
              const docRef = db.collection("books").doc(book.isbn)
              const doc = await docRef.get()
              if (!doc.exists) {
                await docRef.set({
                  bookId: book.isbn,
                  externalSource: "nl_go_kr",
                  title: book.title,
                  author: book.author,
                  publisher: book.publisher,
                  pubYear: book.pubYear,
                  isbn: book.isbn,
                  coverImage: book.coverImage,
                  descriptionRaw: book.description,
                  isActive: true,
                  createdAt: FieldValue.serverTimestamp(),
                })
              }
            }
          } catch (e) {
            console.error("Firestore cache error:", e)
          }
        })()

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
