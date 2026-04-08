
export interface GeminiCandidate {
  title: string
  author: string
  isbn?: string
}

export interface VerifiedBook {
  title: string
  author: string
  publisher: string
  pubYear: number
  isbn: string
  coverImage: string | null
  description: string | null
}

const NL_API_KEY = process.env.NL_API_KEY as string
if (!NL_API_KEY) {
  throw new Error("Missing NL_API_KEY in environment variables")
}
const BASE_URL = "https://www.nl.go.kr/seoji/SearchApi.do"

export async function searchByISBN(isbn: string): Promise<VerifiedBook | null> {
  try {
    const params = new URLSearchParams({
      cert_key: NL_API_KEY,
      result_style: "json",
      page_no: "1",
      page_size: "1",
      isbn: isbn.replace(/-/g, ""),
    })

    const response = await fetch(`${BASE_URL}?${params.toString()}`)
    const data = await response.json()

    if (data.docs && data.docs.length > 0) {
      return await parseNLResult(data.docs[0])
    }
  } catch (error) {
    console.error(`NL Search (ISBN: ${isbn}) Error:`, error)
  }
  return null
}

export async function searchByTitle(title: string, author?: string): Promise<VerifiedBook | null> {
  try {
    const params = new URLSearchParams({
      cert_key: NL_API_KEY,
      result_style: "json",
      page_no: "1",
      page_size: "5",
      title: title,
    })
    
    if (author) params.append("author", author)

    const response = await fetch(`${BASE_URL}?${params.toString()}`)
    const data = await response.json()

    if (data.docs && data.docs.length > 0) {
      // Find the best match (exact title match or first result)
      const bestMatch = data.docs.find((doc: any) => doc.TITLE === title) || data.docs[0]
      return await parseNLResult(bestMatch)
    }
  } catch (error) {
    console.error(`NL Search (Title: ${title}) Error:`, error)
  }
  return null
}

export async function verifyBooks(candidates: GeminiCandidate[]): Promise<VerifiedBook[]> {
  const timeoutPromise = new Promise<null>((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 5000)
  )

  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      try {
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

        // Wait for either search to complete or timeout
        const result = await Promise.race([searchPromise, timeoutPromise])
        return result
      } catch (e) {
        return null
      }
    })
  )

  const verifiedBooks: VerifiedBook[] = []
  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      verifiedBooks.push(res.value)
    }
  }

  return verifiedBooks
}

async function fetchDescription(url: string | null): Promise<string | null> {
  if (!url || !url.startsWith("http")) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function parseNLResult(doc: any): Promise<VerifiedBook> {
  const description = await fetchDescription(doc.BOOK_INTRODUCTION_URL)
  
  return {
    title: doc.TITLE,
    author: doc.AUTHOR,
    publisher: doc.PUBLISHER,
    pubYear: parseInt(doc.PUBLISH_PREDATE?.substring(0, 4) || "0"),
    isbn: doc.EA_ISBN || doc.SET_ISBN || "",
    coverImage: doc.TITLE_URL || null,
    description: description,
  }
}

