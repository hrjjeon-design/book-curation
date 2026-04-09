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
      console.error(`[404] Theme(${themeId}) exists: ${themeDoc.exists}, Curator exists: ${curatorDoc.exists}`)
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

후보 구성 기준:
1. 한국에서 출판된 철학 도서만 (번역서 포함)
2. 실제 존재하는 책만. 제목이나 저자를 지어내지 마세요.
3. 난이도를 섞어주세요: 입문서 3~4권, 중급서 3~4권, 심화서 2~3권
4. 고전과 현대 저작을 균형 있게 포함하세요
5. 같은 저자의 책은 최대 1권까지만
6. ISBN을 아는 경우 포함하세요

응답은 반드시 JSON 배열로만 보내주세요:
[
  { "title": "...", "author": "...", "isbn": "..." },
  ...
]
`
      const step1Result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: step1Prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
      const step1Text = step1Result.response.text()
      let candidates: GeminiCandidate[] = []
      try {
        // Try to parse the Gemini JSON (Robust extraction)
        let jsonToParse = step1Text.trim()
        const startIdx = jsonToParse.indexOf("[")
        const endIdx = jsonToParse.lastIndexOf("]")
        if (startIdx !== -1 && endIdx !== -1) {
          jsonToParse = jsonToParse.substring(startIdx, endIdx + 1)
        }
        candidates = JSON.parse(jsonToParse)
      } catch (e) {
      console.error("Step 1 JSON Parse Error:", e, step1Text)
      throw new Error("Failed to parse candidate list")
    }

    // --- STEP 2: National Library of Korea Verification ---
    const verifiedBooks = await verifyBooks(candidates)

    if (verifiedBooks.length === 0) {
      console.warn(`[404] No verified books found for theme: ${themeId}. Candidates was:`, candidates.length)
      return Response.json({ error: "No verified books found for this theme" }, { status: 404 })
    }

    // --- STEP 3: Gemini Final Recommendation (Streaming) ---
    const step3Prompt = `
당신은 다음과 같은 도서 큐레이터입니다:

[페르소나]
이름: ${curator.name}
설명: ${curator.summary}
말투:
- ${curator.voiceStyle?.join("\n- ") || ""}

[추론 규칙]
${curator.reasoningRules?.join("\n") || ""}

[금지 규칙]
${curator.forbiddenRules?.join("\n") || ""}

서점에 손님이 찾아왔습니다.
손님의 관심 주제: ${theme.name} (${theme.description})

당신의 서가에서 다음 책들이 이 주제와 관련이 있습니다:
${JSON.stringify(verifiedBooks, null, 2)}

지침:
1. 이 목록에서 손님에게 가장 도움이 될 책 3권을 골라주세요.
2. 이 목록에 없는 책은 절대 추천하지 마세요.
3. 가능하면 난이도가 다른 책들을 섞어 골라, 손님이 단계적으로 읽을 수 있게 하세요.
4. introMessage는 손님에게 직접 말을 거는 것처럼 쓰세요.
   - 주제에 대한 짧은 공감이나 맥락을 먼저 건네고
   - 왜 이 세 권을 골랐는지 한두 문장으로 설명하세요
5. 각 책에 대해 다음 정보를 작성하세요:
   - title: 책 제목 (후보 목록과 동일하게)
   - oneLineSummary: 이 책이 뭔지 한 문장으로 (서점 주인이 책을 건네며 하는 말처럼)
   - entryDifficulty: 입문, 중간, 어려움 중 하나
   - philosophicalContext: 이 책이 다루는 철학적 맥락 (학술적이지 않게, 손님이 이해할 수 있게)
   - whyThisBook: 이 손님의 주제에 이 책이 맞는 이유 (일반론 금지, 구체적으로)
   - reasonTags: 짧은 태그 목록 (예: #실존주의, #불안)

응답은 반드시 아래 지정된 JSON 형식으로만 보내주세요.
인사말, 설명, 마크다운 코드 블록(\` \` \`json) 등을 절대 포함하지 마세요.
반드시 '{'로 시작해서 '}'로 끝나는 순수 JSON 데이터만 출력하세요.

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

    const result = await geminiModel.generateContentStream({
      contents: [{ role: "user", parts: [{ text: step3Prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    })
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
