/**
 * ISBN 기반 표지 이미지 조회
 * 우선순위: 알라딘 > 국립중앙도서관 TITLE_URL > null
 */

const ALADIN_BASE = "http://www.aladin.co.kr/ttb/api/ItemLookUp.aspx"

function getAladinKey(): string {
  const key = process.env.ALADIN_TTB_KEY || ""
  if (!key) return ""
  return key
}

export async function fetchCoverByISBN(isbn: string, nlTitleUrl?: string | null): Promise<string | null> {
  // 1. 알라딘 API 시도
  const aladinKey = getAladinKey()
  if (aladinKey && isbn) {
    try {
      const params = new URLSearchParams({
        ttbkey: aladinKey,
        itemIdType: "ISBN13",
        ItemId: isbn.replace(/-/g, ""),
        output: "js",
        Version: "20131101",
        Cover: "Big",
      })

      const res = await fetch(`${ALADIN_BASE}?${params.toString()}`, {
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        const data = await res.json()
        const cover = data?.item?.[0]?.cover
        if (cover && typeof cover === "string" && cover.startsWith("http")) {
          return cover.replace("http://", "https://")
        }
      }
    } catch {
      // 알라딘 실패 시 폴백
    }
  }

  // 2. 국립중앙도서관 TITLE_URL 폴백
  if (nlTitleUrl && nlTitleUrl.startsWith("http")) {
    return nlTitleUrl.replace("http://", "https://")
  }

  return null
}
