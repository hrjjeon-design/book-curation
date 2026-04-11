# 스펙 지시서: #3 자유 검색 개선

> 작성: Claude (설계/검증)
> 구현 대상: 안티그라비티
> 작성일: 2026-04-11
> 상태: 신규

---

## 1. 개요

현재 자유 검색은 사용자 입력을 받아 Firestore의 전체 활성 테마 목록을 Gemini에 전달하고, 가장 관련 있는 테마 3개를 매칭해 돌려주는 방식이다. 이 스펙은 3가지 문제를 해결한다:

1. **성능** — 전체 테마(200+)를 매번 Gemini에 전달하므로 토큰 낭비 + 응답 지연
2. **표지 이미지** — 국립중앙도서관 API의 `TITLE_URL`이 자주 비어있어 표지가 안 보임
3. **검색 UX** — 검색 중 로딩 상태가 부족하고, 결과 없을 때 안내가 빈약

---

## 2. 수정 항목

### 2.1 [HIGH] route-query 성능 개선 — 테마 프리필터링

**파일**: `app/api/route-query/route.ts`

#### 현재 (문제)
```typescript
// line 13-24: 전체 활성 테마를 가져와서 전부 Gemini에 전달
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
```

테마가 200+개면 프롬프트가 수만 토큰이 됨. 비용과 응답 시간 모두 낭비.

#### 수정 방안

**2단계 필터링** 적용:

```typescript
export async function POST(request: Request) {
  try {
    const { query } = await request.json()
    if (!query) {
      return Response.json({ error: "query is required" }, { status: 400 })
    }

    // 1. 전체 테마 가져오기 (메모리 캐시 사용)
    const allThemes = await getAllActiveThemes() // 아래 캐시 함수 참조

    // 2. 1차 필터: 키워드 매칭으로 후보 축소 (최대 30개)
    const queryLower = query.toLowerCase()
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
        if (searchText.includes(token)) score += 1
      }
      // name 직접 매칭은 가중치
      if (theme.name.toLowerCase().includes(queryLower)) score += 3

      return { ...theme, score }
    })

    // score > 0인 것만 취하되, 없으면 전체 중 샘플 30개
    let candidates = scored.filter(t => t.score > 0)
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

    const prompt = `... (기존 프롬프트 유지, themes 변수만 candidates로 교체)`

    // ... 이하 기존 로직 동일
  }
}
```

**캐시 함수 추가** (같은 파일 상단):

```typescript
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
  }))
  themeCacheTime = now
  return themeCache
}
```

**그룹별 샘플링 함수**:

```typescript
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
```

#### 금지사항
- Gemini에 전달하는 테마 수가 30개를 초과하면 안 됨
- 1차 필터는 반드시 서버 사이드 키워드 매칭이어야 함 (Gemini 2회 호출 금지)

---

### 2.2 [CRITICAL] 표지 이미지 개선 — 알라딘 API 연동

**파일**: `lib/nl-api.ts` (함수 추가) + `lib/cover-image.ts` (신규 파일)

#### 현재 (문제)
`parseNLResult`에서 `doc.TITLE_URL`을 coverImage로 사용하나, 국립중앙도서관 API는 표지 URL을 자주 비워서 반환한다. 결과적으로 대부분의 책이 "표지 준비중"으로 표시됨.

#### 수정 방안

ISBN 기반 표지 조회 함수를 별도 파일로 분리:

**신규 파일: `lib/cover-image.ts`**

```typescript
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
        if (cover && cover.startsWith("http")) {
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
```

**`lib/nl-api.ts` 수정** — `parseNLResult` 함수:

```typescript
// 기존 (line 156-177)
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
```

#### 환경 변수

`.env.local`에 추가:

```
ALADIN_TTB_KEY=ttb여기에발급받은키
```

#### 알라딘 TTB 키 발급
- URL: https://www.aladin.co.kr/ttb/wblog_manage.aspx
- 무료, 일 5,000건 호출 가능
- 가입 후 TTB 키 발급 → 환경 변수에 등록

#### 금지사항
- 알라딘 API 실패 시 에러를 throw하지 않음 — 반드시 폴백 (NL URL → null)
- 알라딘 호출 타임아웃 5초 초과 금지
- 알라딘 키가 없으면(`ALADIN_TTB_KEY` 미설정) 기존 로직 그대로 동작해야 함 (graceful degradation)

---

### 2.3 [MEDIUM] 검색 UX 개선

#### 2.3.1 검색 중 로딩 표시

**파일**: `components/search-input.tsx`

검색 버튼에 로딩 상태 추가:

```typescript
interface SearchInputProps {
  onSearch?: (query: string) => void
  loading?: boolean  // 추가
}

export function SearchInput({ onSearch, loading }: SearchInputProps) {
  // ... 기존 코드

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        {loading ? (
          <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        ) : (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        )}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="어떤 철학이 궁금하세요?"
          disabled={loading}
          className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 disabled:opacity-50"
        />
      </div>
    </form>
  )
}
```

**파일**: `app/page.tsx`

`SearchInput`에 loading prop 전달:

```typescript
// 기존: <SearchInput onSearch={handleSearch} />
// 수정:
<SearchInput onSearch={handleSearch} loading={querying} />
```

#### 2.3.2 결과 없음 안내 개선

**파일**: `components/theme-candidate-panel.tsx`

결과 없을 때 재검색 유도 문구 개선:

```typescript
// 기존 (line 52-56)
<div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-lg">
  <p className="text-muted-foreground">관련 주제를 찾지 못했습니다. 다른 질문을 입력해 보세요.</p>
</div>

// 수정:
<div className="p-8 text-center bg-muted/20 border border-dashed border-border rounded-lg space-y-3">
  <p className="text-muted-foreground">
    &quot;{inputQuery}&quot;와 관련된 주제를 찾지 못했습니다.
  </p>
  <p className="text-sm text-muted-foreground/70">
    다른 표현으로 검색해 보세요. 예: &quot;삶의 의미&quot;, &quot;불안&quot;, &quot;정의란 무엇인가&quot;
  </p>
</div>
```

---

### 2.4 [MEDIUM] route-query 입력 검증 강화

**파일**: `app/api/route-query/route.ts`

```typescript
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

    // 이하 trimmedQuery 사용
    // ...
  }
}
```

#### 금지사항
- `query`를 시스템 프롬프트에 직접 삽입하지 않음 (기존 구조 유지)
- 입력 길이 제한은 200자 (UI 측에서는 제한 걸지 않아도 됨, 서버에서 잘라냄)

---

## 3. 수정 파일 요약

| 파일 | 변경 유형 | 설명 |
|------|-----------|------|
| `app/api/route-query/route.ts` | 수정 | 2단계 필터링 + 캐시 + 입력 검증 |
| `lib/cover-image.ts` | **신규** | ISBN 기반 표지 조회 (알라딘 우선) |
| `lib/nl-api.ts` | 수정 | `parseNLResult`에서 `fetchCoverByISBN` 사용 |
| `components/search-input.tsx` | 수정 | loading prop 추가 |
| `components/theme-candidate-panel.tsx` | 수정 | 빈 결과 안내 개선 |
| `app/page.tsx` | 수정 | SearchInput에 loading 전달 |
| `.env.local` | 수정 | `ALADIN_TTB_KEY` 추가 |

---

## 4. 테스트 체크리스트

- [ ] 알라딘 키 없이 배포 → 기존처럼 NL API 표지만 사용 (에러 없음)
- [ ] 알라딘 키 있을 때 → 추천 결과에 표지 이미지 표시됨
- [ ] 자유 검색 "삶의 의미" → 관련 테마 3개 표시, 응답 시간 이전보다 단축
- [ ] 자유 검색 "asdfqwer" (무관한 입력) → "관련 주제를 찾지 못했습니다" 표시
- [ ] 자유 검색 중 검색 아이콘이 로딩 스피너로 변경됨
- [ ] 200자 초과 검색어 입력 → 서버에서 잘려서 정상 처리
- [ ] "더보기" 버튼 → 추가 책에도 표지 이미지 정상 표시

---

## 5. 배포 전 확인사항

1. Vercel 환경 변수에 `ALADIN_TTB_KEY` 등록
2. 기존 `theme_books` 캐시의 `coverImage`는 null일 수 있음 → 캐시 삭제 또는 재생성 필요
3. 알라딘 API 일일 호출 한도 (5,000건) 모니터링
