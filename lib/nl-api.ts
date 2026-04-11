
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

const BASE_URL = "https://www.nl.go.kr/seoji/SearchApi.do"

function getNlApiKey(): string {
  const key = process.env.NL_API_KEY || ""
  if (!key) throw new Error("Missing NL_API_KEY")
  return key
}

export async function searchByISBN(isbn: string): Promise<VerifiedBook | null> {
  const NL_API_KEY = getNlApiKey()

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

    // Error code handling (Spec 6.4)
    const errCode = data.error_code || data.ERROR_CODE
    if (errCode === "010" || errCode === "011") {
      throw new Error(`NLK API Key Error: ${errCode}`)
    }
    if (errCode === "000" || errCode === "015") {
      return null
    }

    if (data.docs && data.docs.length > 0) {
      return await parseNLResult(data.docs[0])
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("NLK API Key Error")) throw error
    console.error(`NL Search (ISBN: ${isbn}) Error:`, error)
  }
  return null
}

export async function searchByTitle(title: string, author?: string): Promise<VerifiedBook | null> {
  const NL_API_KEY = getNlApiKey()

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

    // Error code handling (Spec 6.4)
    const errCode = data.error_code || data.ERROR_CODE
    if (errCode === "010" || errCode === "011") {
      throw new Error(`NLK API Key Error: ${errCode}`)
    }
    if (errCode === "000" || errCode === "015") {
      return null
    }

    if (data.docs && data.docs.length > 0) {
      // Find the best match (exact title match or first result)
      const bestMatch = data.docs.find((doc: any) => doc.TITLE === title) || data.docs[0]
      return await parseNLResult(bestMatch)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("NLK API Key Error")) throw error
    console.error(`NL Search (Title: ${title}) Error:`, error)
  }
  return null
}

export async function verifyBooks(candidates: GeminiCandidate[]): Promise<VerifiedBook[]> {
  const results = await Promise.allSettled(
    candidates.map(async (candidate) => {
      // Individual timeout for each candidate
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 10000)
      )

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

        // Wait for either search to complete or individual timeout
        const result = await Promise.race([searchPromise, timeoutPromise])
        return result
      } catch (e) {
        // If it's the specific Key Error, we want to stop and let the user know
        if (e instanceof Error && e.message.includes("NLK API Key Error")) {
          throw e
        }
        return null
      }
    })
  )

  const verifiedBooks: VerifiedBook[] = []
  for (const res of results) {
    if (res.status === "fulfilled" && res.value) {
      verifiedBooks.push(res.value)
    } else if (res.status === "rejected" && res.reason?.message?.includes("NLK API Key Error")) {
      // Re-throw the key error if one of the parallel calls failed with it
      throw res.reason
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

import { fetchCoverByISBN } from "./cover-image"

async function parseNLResult(doc: any): Promise<VerifiedBook> {
  let descriptionUrl = doc.BOOK_INTRODUCTION_URL
  if (descriptionUrl && descriptionUrl.startsWith("http://")) {
    descriptionUrl = descriptionUrl.replace("http://", "https://")
  }
  const description = await fetchDescription(descriptionUrl)

  const isbn = doc.EA_ISBN || doc.SET_ISBN || ""
  const nlTitleUrl = doc.TITLE_URL || null

  // ISBN 기반으로 표지 조회 (알라딘 우선, NL 폴백)
  const coverImage = await fetchCoverByISBN(isbn, nlTitleUrl)

  return {
    title: doc.TITLE,
    author: doc.AUTHOR,
    publisher: doc.PUBLISHER,
    pubYear: parseInt(doc.PUBLISH_PREDATE?.substring(0, 4) || "0"),
    isbn,
    coverImage,
    description,
  }
}

