import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { initializeApp, getApps, cert } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { searchByISBN, searchByTitle, GeminiCandidate, VerifiedBook } from "../lib/nl-api"

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  })
}

const db = getFirestore()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

async function verifyBooksWithTimeout(
  candidates: GeminiCandidate[],
  timeoutMs = 15000,
  batchSize = 4,
): Promise<VerifiedBook[]> {
  const verified: VerifiedBook[] = []

  // Process in batches to avoid NL API throttling
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (candidate) => {
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), timeoutMs),
        )
        const searchPromise = (async () => {
          let book: VerifiedBook | null = null
          if (candidate.isbn) {
            book = await searchByISBN(candidate.isbn)
          }
          if (!book) {
            book = await searchByTitle(candidate.title, candidate.author)
          }
          return book
        })()

        return Promise.race([searchPromise, timeoutPromise])
      }),
    )

    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        verified.push(res.value)
      }
    }

    // Small delay between batches
    if (i + batchSize < candidates.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  return verified
}

async function buildCacheForTheme(theme: {
  themeId: string
  name: string
  description: string
  relatedConcepts?: string[]
}): Promise<number> {
  // Check if cache already exists and is fresh (less than 7 days old)
  const existingCache = await db.collection("theme_books").doc(theme.themeId).get()
  if (existingCache.exists) {
    const data = existingCache.data()!
    const cachedAt = data.cachedAt?.toDate?.() || new Date(0)
    const daysSinceCached = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceCached < 7 && data.verifiedBooks?.length >= 10) {
      console.log(`  ⏭ ${theme.themeId}: 캐시가 최신입니다 (${data.verifiedBooks.length}권, ${Math.floor(daysSinceCached)}일 전)`)
      return data.verifiedBooks.length
    }
  }

  console.log(`  🔍 ${theme.themeId}: Gemini 후보 생성 중...`)

  const prompt = `
당신은 한국어 철학 도서 전문가입니다.

다음 주제에 대해 추천할 만한 한국어 철학 도서 후보를 20권 제시하세요:
주제: ${theme.name} (${theme.description})
관련 개념: ${theme.relatedConcepts?.join(", ") || ""}

후보 구성 기준:
1. 한국에서 출판된 철학 도서만 (번역서 포함)
2. 실제 존재하는 책만. 제목이나 저자를 지어내지 마세요.
3. 난이도를 섞어주세요: 입문서 7~8권, 중급서 7~8권, 심화서 4~6권
4. 고전과 현대 저작을 균형 있게 포함하세요
5. 같은 저자의 책은 최대 2권까지만
6. ISBN을 아는 경우 포함하세요

응답은 반드시 JSON 배열로만 보내주세요:
[
  { "title": "...", "author": "...", "isbn": "..." },
  ...
]
`

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  })
  const text = result.response.text()

  let candidates: GeminiCandidate[] = []
  try {
    let jsonToParse = text.trim()
    const startIdx = jsonToParse.indexOf("[")
    const endIdx = jsonToParse.lastIndexOf("]")
    if (startIdx !== -1 && endIdx !== -1) {
      jsonToParse = jsonToParse.substring(startIdx, endIdx + 1)
    }
    candidates = JSON.parse(jsonToParse)
  } catch (e) {
    console.error(`  ❌ ${theme.themeId}: JSON 파싱 실패`)
    return 0
  }

  console.log(`  📚 ${theme.themeId}: ${candidates.length}권 후보 → 국립도서관 검증 중...`)

  const verifiedBooks = await verifyBooksWithTimeout(candidates)

  console.log(`  ✅ ${theme.themeId}: ${verifiedBooks.length}/${candidates.length}권 검증 통과`)

  if (verifiedBooks.length === 0) {
    console.warn(`  ⚠️ ${theme.themeId}: 검증된 책이 없습니다`)
    return 0
  }

  // Deduplicate by ISBN
  const uniqueBooks = Array.from(
    new Map(verifiedBooks.map((b) => [b.isbn, b])).values(),
  )

  // Save to Firestore
  await db.collection("theme_books").doc(theme.themeId).set({
    themeId: theme.themeId,
    themeName: theme.name,
    verifiedBooks: uniqueBooks.map((b) => ({
      title: b.title,
      author: b.author,
      publisher: b.publisher,
      pubYear: b.pubYear,
      isbn: b.isbn,
      coverImage: b.coverImage,
      description: b.description,
    })),
    totalCount: uniqueBooks.length,
    cachedAt: FieldValue.serverTimestamp(),
  })

  // Also cache individual books in 'books' collection
  for (const book of uniqueBooks) {
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

  return uniqueBooks.length
}

async function main() {
  const targetThemeId = process.argv[2]
  const allFlag = process.argv.includes("--all")
  let themeDocs
  if (targetThemeId && !targetThemeId.startsWith("--")) {
    const doc = await db.collection("themes").doc(targetThemeId).get()
    if (!doc.exists) {
      console.error(`Theme "${targetThemeId}" not found`)
      process.exit(1)
    }
    themeDocs = [doc]
  } else {
    let query = db.collection("themes").where("isActive", "==", true)
    if (!allFlag) {
      console.log("Caching 'core' themes only (use --all for all themes)")
      query = query.where("tier", "==", "core")
    }
    const snapshot = await query.get()
    themeDocs = snapshot.docs
  }

  console.log(`\n📦 캐시 구축 시작: ${themeDocs.length}개 주제\n`)

  let totalBooks = 0
  for (const doc of themeDocs) {
    const data = doc.data()!
    const count = await buildCacheForTheme({
      themeId: doc.id,
      name: data.name,
      description: data.description,
      relatedConcepts: data.relatedConcepts,
    })
    totalBooks += count
    // Rate limiting: wait 2 seconds between themes to avoid API throttling
    if (themeDocs.length > 1) {
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  console.log(`\n✅ 캐시 구축 완료: 총 ${totalBooks}권`)
}

main().catch(console.error)
