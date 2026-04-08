# 국립중앙도서관 ISBN API 연동 명세

> 버전: v2.0 | 작성일: 2026-04-08

## 1. 목적

국립중앙도서관 DB를 마스터 도서 데이터로 사용한다. Gemini의 맥락 추천 능력과 국립중앙도서관의 실존 도서 데이터를 결합하여, **할루시네이션 없는 AI 추천**을 구현한다.

### 핵심 원칙

1. **할루시네이션 금지** — 국립중앙도서관에서 실존이 확인된 책만 추천한다
2. **맥락 검색** — 키워드가 아닌 주제/상황 기반으로 추천한다
3. **AI스러운 추천** — 큐레이터 페르소나, 추천 이유, 철학적 맥락을 포함한다

---

## 2. 추천 흐름 (변경)

### 변경 전

```
Firestore books (수동 등록) → Gemini "이 중에서 골라" → 추천
```

### 변경 후 (3단계 흐름)

```
[1단계] Gemini 후보 생성
  → 주제(theme) 정보를 기반으로 Gemini에게 후보 도서 10권 요청
  → 제목, 저자, ISBN(알면)을 반환받음

[2단계] 국립중앙도서관 실존 확인
  → 10권을 ISBN 또는 제목+저자로 병렬 검색
  → 실존 확인된 책만 필터링 + 메타데이터(표지, 출판사, 출판연도 등) 확보

[3단계] Gemini 최종 추천 생성 (스트리밍)
  → 실존 확인된 후보 목록을 Gemini에게 전달
  → 큐레이터 페르소나로 3권 선정 + 추천 이유 작성
  → 스트리밍으로 사용자에게 전달
```

### 할루시네이션 방지 메커니즘

- 1단계에서 Gemini가 추천한 책이 2단계에서 실존 확인 안 되면 **탈락**
- 3단계에는 실존 확인된 책만 들어감 → 있지 않은 책이 추천될 수 없음
- 실존 확인된 책이 3권 미만이면, 1단계를 재시도하거나 확인된 책만으로 추천

---

## 3. 사용 API

**ISBN/서지정보 API (seoji)**

- 엔드포인트: `https://www.nl.go.kr/seoji/SearchApi.do`
- 메서드: GET
- 응답 형식: JSON (`result_style=json`)
- 인증: `cert_key` (API 키)

---

## 4. 환경 변수

```
# .env.local에 추가
NL_API_KEY=              # 국립중앙도서관 API 키 (발급 후 입력)
```

---

## 5. 파일 구조

```
lib/
  nl-api.ts              # 국립중앙도서관 API 호출 유틸리티 (신규)
app/api/recommend/
  route.ts               # 추천 API (기존 파일 수정 — 3단계 흐름으로 변경)
```

---

## 6. lib/nl-api.ts — API 호출 유틸리티

### 6.1 searchByISBN(isbn: string): Promise<NLBookResult | null>

```typescript
// GET https://www.nl.go.kr/seoji/SearchApi.do
//   ?cert_key={NL_API_KEY}
//   &result_style=json
//   &page_no=1
//   &page_size=1
//   &isbn={isbn}
```

### 6.2 searchByTitle(title: string, author?: string): Promise<NLBookResult | null>

```typescript
// GET https://www.nl.go.kr/seoji/SearchApi.do
//   ?cert_key={NL_API_KEY}
//   &result_style=json
//   &page_no=1
//   &page_size=5
//   &title={encodeURIComponent(title)}
//   &author={encodeURIComponent(author)}   // author가 있을 때만
```

제목+저자 검색 시 결과가 여러 건이면, 제목이 가장 정확히 일치하는 첫 번째 결과를 반환한다.

### 6.3 verifyBooks(candidates: GeminiCandidate[]): Promise<VerifiedBook[]>

Gemini가 추천한 후보 목록을 받아 **병렬로** 국립중앙도서관 API 검색. 실존 확인된 책만 반환한다.

```typescript
interface GeminiCandidate {
  title: string
  author: string
  isbn?: string           // Gemini가 알면 제공, 모르면 없음
}

interface VerifiedBook {
  title: string
  author: string
  publisher: string
  pubYear: number          // PUBLISH_PREDATE에서 연도(앞 4자리) 추출
  isbn: string             // EA_ISBN
  coverImage: string | null // TITLE_URL (빈 문자열이면 null)
  description: string | null // BOOK_INTRODUCTION_URL
}
```

로직:
1. ISBN이 있으면 `searchByISBN()` 우선
2. ISBN이 없거나 결과 없으면 `searchByTitle(title, author)` 시도
3. 둘 다 결과 없으면 해당 책은 탈락 (반환 배열에서 제외)
4. 병렬 호출하되, 전체 타임아웃 5초. 타임아웃된 건은 탈락 처리

### 6.4 응답 파싱 규칙

- `PUBLISH_PREDATE`: `"20220509"` → `2022` (앞 4자리만 추출)
- `TITLE_URL`: 빈 문자열 `""` → `null`
- `BOOK_INTRODUCTION_URL`: 값이 URL이면 해당 URL을 fetch하여 텍스트 추출. 빈 문자열이면 `null`. 실패 시 `null`.
- API 에러 코드 처리:
  - `000`: 시스템 에러 → 해당 건 스킵 (throw 하지 않음)
  - `010`, `011`: 키 문제 → throw (전체 중단)
  - `015`: 파라미터 누락 → 해당 건 스킵

---

## 7. app/api/recommend/route.ts — 추천 API 변경

### 7.1 1단계: Gemini 후보 생성

기존 프롬프트를 교체한다. Firestore books를 조회하지 않는다.

**프롬프트:**

```
당신은 한국어 철학 도서 전문가입니다.

다음 주제에 대해 추천할 만한 한국어 철학 도서 후보를 10권 제시하세요:
주제: {theme.name} ({theme.description})
관련 개념: {theme.relatedConcepts.join(", ")}

지침:
1. 한국에서 출판된 철학 도서만 추천하세요 (번역서 포함)
2. 실제 존재하는 책만 추천하세요. 제목이나 저자를 지어내지 마세요.
3. ISBN을 아는 경우 포함하세요.

응답은 반드시 JSON 배열로만 보내주세요:
[
  { "title": "...", "author": "...", "isbn": "..." },
  ...
]
```

### 7.2 2단계: 국립중앙도서관 실존 확인

```typescript
const verifiedBooks = await verifyBooks(candidates)
// 실존 확인된 책이 0권이면 에러 반환
// 3권 미만이면 확인된 책만으로 진행
```

### 7.3 3단계: Gemini 최종 추천 (스트리밍)

기존 프롬프트와 동일한 구조. 단, 후보 도서 목록이 Firestore가 아닌 2단계 결과.

**프롬프트:**

```
당신은 다음과 같은 페르소나를 가진 도서 큐레이터입니다:
이름: {curator.name}
설명: {curator.summary}
말투: {curator.voiceStyle.join(", ")}

사용자가 다음 주제에 대해 책 추천을 원합니다:
주제: {theme.name} ({theme.description})

추천할 후보 도서 목록:
{verifiedBooks를 JSON으로}

지침:
1. 후보 도서들 중에서 주제에 가장 적합한 책을 선정하세요. (최대 3권)
2. 후보 목록에 없는 책은 절대 추천하지 마세요.
3. 각 책에 대해 다음 정보를 작성하세요:
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
```

3단계 응답은 **스트리밍**으로 전달한다 (현재 구현된 스트리밍 방식 유지).

### 7.4 응답 스트리밍 구조

첫 줄에 실존 확인된 도서 메타데이터(표지, 출판사 등)를 전송하고, 이후 Gemini 스트리밍.

```
{"__meta__": [{ title, author, publisher, pubYear, isbn, coverImage }, ...]}
{Gemini 스트리밍 청크들...}
```

클라이언트 코드 변경 없음. 기존 스트리밍 파싱 로직 그대로 사용.

---

## 8. Firestore books 컬렉션 역할 변경

### 변경 전
- 추천 후보 도서의 마스터 저장소

### 변경 후
- **캐시/히스토리 용도**로만 사용
- 추천 완료 후, 실존 확인된 도서 정보를 저장 (중복 시 스킵)
- 추천 후보 소스로는 사용하지 않음

저장 시점: 3단계 추천 완료 후 fire-and-forget으로 저장.

```typescript
// 추천 완료 후
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
```

---

## 9. 성능 고려

| 단계 | 예상 소요 | 비고 |
|---|---|---|
| 1단계 Gemini 후보 생성 | 2~4초 | 짧은 JSON 응답 |
| 2단계 국립중앙도서관 병렬 검색 | 1~3초 | 10건 병렬, 타임아웃 5초 |
| 3단계 Gemini 최종 추천 | 3~6초 | 스트리밍으로 체감 단축 |
| **총합** | **6~13초** | |

### 체감 속도 개선

- 1~2단계 진행 중 사용자에게 "도서를 찾고 있습니다..." 표시
- 3단계 진입 시 "추천을 작성하고 있습니다..." 로 전환
- introMessage → 책 순서대로 스트리밍 표시

### 향후 캐싱 (선택)

같은 themeId에 대한 추천 결과를 Firestore에 캐시. TTL 24시간. 캐시 히트 시 즉시 응답. MVP에서는 구현하지 않아도 됨.

---

## 10. 금지 사항

- 클라이언트에서 국립중앙도서관 API 직접 호출 금지 (API 키 노출)
- `externalSource` 값은 반드시 `"nl_go_kr"` 사용
- 2단계에서 실존 확인 안 된 책을 3단계에 넘기지 않음
- 3단계 프롬프트에 "후보 목록에 없는 책은 절대 추천하지 마세요" 반드시 포함

---

## 11. 구현 순서

1. `.env.local`에 `NL_API_KEY` 추가 (발급 후)
2. `lib/nl-api.ts` 구현 (searchByISBN, searchByTitle, verifyBooks)
3. `app/api/recommend/route.ts` 수정 (3단계 흐름)
4. 프론트엔드 로딩 메시지 업데이트 ("도서를 찾고 있습니다..." → "추천을 작성하고 있습니다...")
5. 기존 Firestore books 시드 데이터 — 삭제하지 않음 (캐시로 유지)
