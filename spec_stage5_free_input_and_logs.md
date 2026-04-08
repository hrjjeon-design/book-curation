# 철학 도서 큐레이션 MVP — 5단계 구현 명세서

버전: v1.0  
작성일: 2026-04-08  
작성: Claude (설계)

---

## 1. 목표

| 항목 | 설명 |
|------|------|
| 자유 입력 → Theme 라우팅 | 사용자가 검색창에 자유 입력 시, Gemini가 가장 가까운 theme 2~3개 후보를 반환 |
| Theme 후보 선택 | 사용자가 후보 중 하나를 선택하면 기존 주제 선택형 추천 흐름으로 연결 |
| interaction_logs 연결 | 주요 이벤트(자유 입력 제출, 주제 선택, 추천 렌더)를 Firestore에 기록 |

---

## 2. 구현 대상 파일

| 파일 | 신규/수정 |
|------|---------|
| `app/api/route-query/route.ts` | 신규 |
| `app/api/logs/route.ts` | 신규 |
| `app/page.tsx` | 수정 |

---

## 3. API 명세

### 3.1 POST /api/route-query

자유 입력 텍스트를 Gemini로 분석해 가장 가까운 theme를 최대 3개 반환합니다.

#### Request Body
```json
{
  "query": "요즘 불안하고 삶의 방향을 모르겠어요"
}
```

#### Response Body
```json
{
  "inputQuery": "요즘 불안하고 삶의 방향을 모르겠어요",
  "resolvedThemes": [
    {
      "themeId": "anxiety",
      "name": "불안할 때 읽는 철학",
      "reason": "불안과 방향 상실이라는 감정이 핵심 키워드로 연결됩니다."
    },
    {
      "themeId": "meaning_of_life",
      "name": "삶의 방향을 잃었을 때 읽는 철학",
      "reason": "삶의 의미와 방향을 찾고자 하는 질문과 직결됩니다."
    }
  ]
}
```

#### 에러 응답
- 400: `{ "error": "query is required" }`
- 500: `{ "error": "Failed to route query" }`

#### 내부 처리 흐름
1. Firestore `themes` 컬렉션에서 `isActive == true` 전체 조회
2. 각 theme의 `themeId`, `name`, `description`, `relatedConcepts`, `exampleQueries` 추출
3. Gemini 프롬프트: 사용자 입력 + 전체 theme 목록 → 가장 가까운 theme 최대 3개 선택
4. 각 theme에 reason 한 문장 포함
5. JSON 응답 반환

#### Gemini 프롬프트 구조 (한국어)
```
다음은 철학 도서 큐레이션 서비스의 주제 목록입니다:
{themes JSON}

사용자 입력:
"{query}"

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
```

---

### 3.2 POST /api/logs

interaction_logs 컬렉션에 이벤트 1건을 저장합니다.

#### Request Body
```json
{
  "sessionId": "sess_abc123",
  "userId": "uid_123",
  "eventType": "theme_selected",
  "entryType": "theme_selection",
  "themeId": "anxiety",
  "resolvedThemeIds": ["anxiety"],
  "inputQuery": null,
  "recommendedBookIds": [],
  "deviceType": "desktop"
}
```

#### 필드 상세

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `sessionId` | string | 필수 | 페이지 로드 시 클라이언트에서 생성한 고유값 |
| `userId` | string \| null | 선택 | 로그인 시 uid, 미로그인 시 null |
| `eventType` | string | 필수 | 아래 eventType 목록 참고 |
| `entryType` | string | 필수 | `"theme_selection"` \| `"free_input"` |
| `themeId` | string \| null | 선택 | 이벤트 대상 themeId |
| `resolvedThemeIds` | string[] | 필수 | 빈 배열 허용 |
| `inputQuery` | string \| null | 선택 | 자유 입력 시 원본 텍스트 |
| `recommendedBookIds` | string[] | 필수 | 추천 결과 시 bookId 목록, 그 외 빈 배열 |
| `deviceType` | string | 필수 | `"desktop"` \| `"mobile"` \| `"tablet"` |

#### eventType 목록
- `free_query_submitted` — 자유 입력 제출
- `theme_selected` — 주제 선택 (주제 타일 클릭 또는 자유 입력 후 후보 선택)
- `recommendation_rendered` — 추천 결과 화면 표시

#### 서버 처리
- `eventId`: Firestore 자동 생성 ID를 문서 내부에도 저장
- `createdAt`: 서버 시간 사용
- `isReturnVisit`: MVP에서는 항상 `false`
- `selectedBookId`: MVP에서는 항상 `null`

#### Response Body
```json
{ "status": "ok", "eventId": "auto_generated_id" }
```

---

## 4. page.tsx 수정 사항

### 4.1 추가할 상태

```typescript
const [freeQueryResult, setFreeQueryResult] = useState<{
  inputQuery: string
  resolvedThemes: { themeId: string; name: string; reason: string }[]
} | null>(null)
const [querying, setQuerying] = useState(false)
const [sessionId] = useState(() => `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
```

### 4.2 handleSearch 구현

```typescript
const handleSearch = async (query: string) => {
  setQuerying(true)
  try {
    // 1. interaction_logs: free_query_submitted
    fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        userId: auth.currentUser?.uid ?? null,
        eventType: "free_query_submitted",
        entryType: "free_input",
        themeId: null,
        resolvedThemeIds: [],
        inputQuery: query,
        recommendedBookIds: [],
        deviceType: getDeviceType(),
      }),
    })

    // 2. /api/route-query 호출
    const res = await fetch("/api/route-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    const data = await res.json()
    setFreeQueryResult(data)
    window.scrollTo(0, 0)
  } catch (err) {
    console.error("Failed to route query", err)
  } finally {
    setQuerying(false)
  }
}
```

### 4.3 handleTopicClick 수정 (로그 추가)

기존 handleTopicClick에 아래 2개 로그 호출 추가:

```typescript
// 테마 선택 시
fetch("/api/logs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId,
    userId: auth.currentUser?.uid ?? null,
    eventType: "theme_selected",
    entryType: freeQueryResult ? "free_input" : "theme_selection",
    themeId: themeId,
    resolvedThemeIds: [themeId],
    inputQuery: freeQueryResult?.inputQuery ?? null,
    recommendedBookIds: [],
    deviceType: getDeviceType(),
  }),
})

// 추천 결과 수신 후
fetch("/api/logs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sessionId,
    userId: auth.currentUser?.uid ?? null,
    eventType: "recommendation_rendered",
    entryType: freeQueryResult ? "free_input" : "theme_selection",
    themeId: themeId,
    resolvedThemeIds: [themeId],
    inputQuery: freeQueryResult?.inputQuery ?? null,
    recommendedBookIds: data.books.map((b: any) => b.bookId).filter(Boolean),
    deviceType: getDeviceType(),
  }),
})
```

### 4.4 getDeviceType 유틸 함수

page.tsx 내 선언:
```typescript
const getDeviceType = (): string => {
  const w = window.innerWidth
  if (w < 768) return "mobile"
  if (w < 1024) return "tablet"
  return "desktop"
}
```

### 4.5 화면 렌더링 우선순위

```
recommendation → freeQueryResult → 기본 화면(themes)
```

freeQueryResult가 있을 때 ThemeCandidatePanel을 렌더링합니다.

---

## 5. ThemeCandidatePanel 컴포넌트

### 파일: `components/theme-candidate-panel.tsx`

### Props
```typescript
interface ThemeCandidatePanelProps {
  inputQuery: string
  resolvedThemes: { themeId: string; name: string; reason: string }[]
  onSelect: (themeId: string) => void
  onBack: () => void
}
```

### 렌더링 구조
- 상단: 입력한 텍스트 표시 ("**{inputQuery}**에 대한 추천 주제")
- 중단: theme 후보 카드 목록 (최대 3개)
  - 각 카드: 테마명 (굵게) + reason 한 줄 (muted)
  - 클릭 시 onSelect(themeId) 호출
- 하단: "← 다시 검색" 버튼 (onBack 호출 → freeQueryResult null로 초기화)

### 스타일
- 기존 TopicTile 스타일 기반 (`bg-card border border-border rounded-lg`)
- reason 텍스트: `text-muted-foreground text-sm`
- 카드 간격: `gap-3`
- 카드 레이아웃: `flex-col` (세로 배치)

---

## 6. 렌더링 흐름 전체 정리

```
[기본 화면]
  └─ 검색창 입력 → handleSearch
      └─ querying: true → 로딩 표시
      └─ /api/route-query 호출
      └─ freeQueryResult 저장
      └─ ThemeCandidatePanel 표시
          └─ 테마 카드 클릭 → handleTopicClick(themeId)
              └─ theme_selected 로그
              └─ /api/recommend 호출
              └─ recommendation_rendered 로그
              └─ recommendation 저장
              └─ RecommendationResult 표시
                  └─ onBack → recommendation null로 초기화

[기본 화면]
  └─ 테마 타일 클릭 → handleTopicClick(themeId)
      └─ theme_selected 로그
      └─ /api/recommend 호출
      └─ recommendation_rendered 로그
      └─ RecommendationResult 표시
```

---

## 7. 로딩 상태 처리

| 상태 | 표시 |
|------|------|
| `loading` (themes 로딩) | 기존 Skeleton |
| `recommending` (추천 로딩) | 기존 Skeleton |
| `querying` (자유 입력 라우팅 중) | 기존 Skeleton과 동일 패턴 |

loading \|\| recommending \|\| querying 중 하나라도 true이면 Skeleton 표시.

---

## 8. 검증 기준

5단계 점검 시 아래 항목을 확인합니다.

- [ ] `/api/route-query` POST — query 없으면 400 반환
- [ ] `/api/route-query` POST — themes 조회 후 Gemini 호출, resolvedThemes 최대 3개
- [ ] `/api/route-query` — Firestore Admin SDK 사용 (클라이언트 직접 접근 없음)
- [ ] `/api/logs` POST — interaction_logs 컬렉션에 저장, eventId 반환
- [ ] `page.tsx` — handleSearch가 `/api/route-query` 호출
- [ ] `page.tsx` — freeQueryResult 있을 때 ThemeCandidatePanel 렌더링
- [ ] `page.tsx` — handleTopicClick에 theme_selected, recommendation_rendered 로그 호출
- [ ] `ThemeCandidatePanel` — reason 한 줄 표시, 클릭 시 handleTopicClick 연결
- [ ] `ThemeCandidatePanel` — onBack 클릭 시 freeQueryResult 초기화
- [ ] sessionId — 페이지 로드 시 1회 생성, 이후 동일 값 유지
- [ ] 로그 호출 실패 시 추천 흐름에 영향 없음 (fire-and-forget)

---

## 9. 구현 시 주의사항

1. **로그는 fire-and-forget** — await 없이 호출, 실패해도 추천 흐름에 영향 없어야 합니다.
2. **route-query는 themes 전체를 조회** — `isActive == true`인 전체 목록을 프롬프트에 포함합니다.
3. **resolvedThemes themeId는 반드시 Firestore에 존재하는 ID** — Gemini가 목록에 없는 ID를 반환하면 무시합니다. (클라이언트에서 필터 불필요 — Gemini 프롬프트에서 "목록에 없는 새 주제를 만들지 마세요" 지침으로 방지)
4. **getDeviceType은 window 접근** — SSR에서 호출되지 않도록 이벤트 핸들러 내부에서만 사용합니다.
5. **freeQueryResult와 recommendation 초기화** — onBack 시 각각 null로 초기화합니다.
