# 철학 도서 큐레이션 MVP - 전체 Firestore 스키마 설계서 v2.1

## 1. 문서 목적

이 문서는 철학 도서 큐레이션 MVP를 Firestore 기반으로 구현하기 위한  
전체 컬렉션 구조, 문서 필드, 저장 원칙, 조회 흐름을 정의합니다.

이 문서는 아래 기능을 모두 고려합니다.

- 주제 선택형 추천
- 자유 입력형 추천
- 추천 결과 생성
- 사용자 로그인(Google)
- 사용자별 추천 히스토리 조회
- 최소 수준의 운영/분석 로그 저장

---

## 2. 설계 원칙

### 2.1 Firestore 우선 원칙
Firestore는 관계형 DB처럼 조인 중심으로 설계하지 않고,  
문서 단위 조회와 비정규화를 우선합니다.

### 2.2 MVP 원칙
- 처음부터 완전한 정규화 구조를 만들지 않는다
- 실제 조회 흐름을 우선한다
- 사람이 수동으로 관리해야 하는 구조를 최소화한다
- 추천 품질보다 먼저 작동 가능한 구조를 확보한다

### 2.3 저장 범위 원칙
- 국립중앙도서관 오픈 API의 전체 데이터를 대량 저장하지 않는다
- 서비스에 필요한 최소 필드만 저장한다
- 외부 도서 메타데이터는 필요 시 캐시/동기화한다

---

## 3. 전체 컬렉션 구조 개요

초기 MVP에서는 아래 컬렉션을 권장합니다.

- `users`
- `themes`
- `books`
- `curator_config`
- `interaction_logs`
- `recommendation_cache` (선택)
- `system_config` (선택)

하위 컬렉션:
- `users/{uid}/recommendation_history`

---

## 4. 구현 우선순위

1. `themes`
2. `books`
3. `curator_config`
4. `users`
5. `users/{uid}/recommendation_history`
6. `interaction_logs`
7. `recommendation_cache` (선택)
8. `system_config` (선택)

---

## 5. 컬렉션별 상세 설계

## 5.1 `users`

### 역할
- Google 로그인 사용자 프로필 저장
- 앱 내부 사용자 상태 저장
- 추천 히스토리 상위 문서 역할

### 경로
`/users/{uid}`

### 문서 ID
- Firebase Auth UID 사용

### 필수 필드
- `uid`: string
- `email`: string | null
- `displayName`: string | null
- `photoURL`: string | null
- `provider`: string
- `role`: string
- `status`: string
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `lastLoginAt`: timestamp

### 선택 필드
- `lastSeenAt`: timestamp
- `isOnboarded`: boolean
- `favoriteThemes`: string[]
- `savedBookIds`: string[]
- `recentBookIds`: string[]

### 예시
```json
{
  "uid": "uid_123",
  "email": "user@example.com",
  "displayName": "홍길동",
  "photoURL": "https://...",
  "provider": "google.com",
  "role": "user",
  "status": "active",
  "createdAt": "timestamp",
  "updatedAt": "timestamp",
  "lastLoginAt": "timestamp"
}
```

---

## 5.2 `themes`

### 역할
- 사용자에게 노출되는 20개 주제 저장
- 자유 입력 라우팅의 기준점
- 상위 그룹 관리
- 주제 선택 KPI 기준

### 경로
`/themes/{themeId}`

### 문서 ID 예시
- `anxiety`
- `meaning_of_life`
- `relationships`
- `ai_and_human`
- `justice`
- `start_philosophy`

### 필수 필드
- `themeId`: string
- `name`: string
- `shortLabel`: string
- `group`: string
- `type`: string
- `description`: string
- `relatedConcepts`: string[]
- `exampleQueries`: string[]
- `priorityOrder`: number
- `isActive`: boolean
- `createdAt`: timestamp
- `updatedAt`: timestamp

### 예시
```json
{
  "themeId": "ai_and_human",
  "name": "AI와 인간을 생각하게 하는 철학",
  "shortLabel": "AI와 인간",
  "group": "관심사형",
  "type": "주제형",
  "description": "AI 시대에 인간의 의미와 판단을 다시 생각하게 하는 철학책을 찾을 때 사용하는 주제",
  "relatedConcepts": ["AI", "인간", "기술", "윤리", "판단"],
  "exampleQueries": [
    "AI 시대에 인간이란 뭘까",
    "생성형 AI와 철학 관련 책 추천"
  ],
  "priorityOrder": 9,
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 5.3 `books`

### 역할
- 추천 대상 철학 도서 메타데이터 저장
- 국립중앙도서관 오픈 API에서 가져온 최소 필드 보관
- 추천 후보군 생성 기반

### 경로
`/books/{bookId}`

### 문서 ID 전략
- ISBN 우선
- 없으면 내부 ID

### 필수 필드
- `bookId`: string
- `externalSource`: string
- `externalId`: string
- `title`: string
- `author`: string
- `publisher`: string | null
- `pubYear`: number | null
- `isbn`: string | null
- `language`: string
- `descriptionRaw`: string
- `categoryRaw`: string[]
- `sourceLink`: string | null
- `coverImage`: string | null
- `searchKeywords`: string[]
- `isActive`: boolean
- `createdAt`: timestamp
- `updatedAt`: timestamp

### 선택 필드
- `normalizedTitle`: string
- `authorKeywords`: string[]
- `themeHints`: string[]
- `cachedFromQuery`: string | null

### 예시
```json
{
  "bookId": "9780000000001",
  "externalSource": "nl_go_kr",
  "externalId": "9780000000001",
  "title": "정의란 무엇인가",
  "author": "마이클 샌델",
  "publisher": "와이즈베리",
  "pubYear": 2014,
  "isbn": "9788937834797",
  "language": "ko",
  "descriptionRaw": "정의와 공정, 도덕적 딜레마를 통해 올바른 사회를 묻는 책",
  "categoryRaw": ["정치철학", "윤리학", "정의"],
  "sourceLink": "https://...",
  "coverImage": "https://...",
  "searchKeywords": ["정의", "공정", "윤리", "정치철학"],
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 5.4 `curator_config`

### 역할
- 추천자 페르소나와 생성 규칙 저장
- 프롬프트의 고정 자산 역할
- 환경별 프롬프트 관리 가능

### 경로
`/curator_config/{personaId}`

### 초기 문서 ID
- `default_curator`

### 필수 필드
- `personaId`: string
- `name`: string
- `summary`: string
- `voiceStyle`: string[]
- `reasoningRules`: string[]
- `forbiddenRules`: string[]
- `outputFields`: string[]
- `promptVersion`: string
- `isActive`: boolean
- `updatedAt`: timestamp

### 예시
```json
{
  "personaId": "default_curator",
  "name": "철학 교수이자 철학 서점 운영자",
  "summary": "철학적 맥락과 입문 난이도를 함께 설명하며, 공개된 책 정보와 일반적 맥락 안에서만 말하는 추천자",
  "voiceStyle": [
    "짧고 명확하게 설명",
    "철학적 맥락을 먼저 설명",
    "입문 난이도를 함께 제시",
    "과장하지 않음"
  ],
  "reasoningRules": [
    "공개 서지정보와 일반적으로 알려진 철학적 맥락 안에서만 설명",
    "사용자의 질문과 책의 연결 이유를 설명"
  ],
  "forbiddenRules": [
    "본문을 모두 읽은 것처럼 단정 금지",
    "장별 논증 설명 금지",
    "확인되지 않은 인용 생성 금지"
  ],
  "outputFields": [
    "oneLineSummary",
    "philosophicalContext",
    "entryDifficulty",
    "whyThisBookForThisQuery",
    "reasonTags"
  ],
  "promptVersion": "v1.0",
  "isActive": true,
  "updatedAt": "timestamp"
}
```

---

## 5.5 `interaction_logs`

### 역할
- KPI 추적
- 주제 선택 분석
- 추천 결과 상세 보기 분석
- 재방문 분석

### 경로
`/interaction_logs/{eventId}`

### 문서 1건 = 이벤트 1건

### 필수 필드
- `eventId`: string
- `sessionId`: string
- `userId`: string | null
- `eventType`: string
- `entryType`: string
- `themeId`: string | null
- `resolvedThemeIds`: string[]
- `inputQuery`: string | null
- `recommendedBookIds`: string[]
- `selectedBookId`: string | null
- `deviceType`: string
- `isReturnVisit`: boolean
- `createdAt`: timestamp

### `eventType` 예시
- `theme_selected`
- `free_query_submitted`
- `recommendation_rendered`
- `book_detail_viewed`
- `return_visit_detected`

### `entryType` 예시
- `theme_selection`
- `free_input`
- `book_or_author_entry`

---

## 5.6 `users/{uid}/recommendation_history`

### 역할
- 사용자가 과거에 어떤 주제로 어떤 책을 추천받았는지 조회 가능하게 하는 저장 구조
- “내 추천 기록” 화면의 핵심 데이터

### 경로
`/users/{uid}/recommendation_history/{historyId}`

### 문서 ID
- Firestore 자동 생성 ID 권장

### 필수 필드
- `historyId`: string
- `userId`: string
- `entryType`: string
- `inputQuery`: string | null
- `selectedThemeId`: string | null
- `selectedThemeLabel`: string | null
- `resolvedThemeIds`: string[]
- `resolvedThemeLabels`: string[]
- `recommendedBooks`: array
- `createdAt`: timestamp
- `updatedAt`: timestamp

### 선택 필드
- `deviceType`: string | null
- `locale`: string | null
- `version`: string | null

### `recommendedBooks` 배열 필드
- `bookId`: string | null
- `title`: string
- `author`: string
- `oneLineSummary`: string
- `philosophicalContext`: string
- `entryDifficulty`: string
- `whyThisBook`: string
- `reasonTags`: string[]
- `publisher`: string | null
- `pubYear`: number | null
- `isbn`: string | null
- `coverImage`: string | null
- `sourceLink`: string | null

### 예시
```json
{
  "historyId": "rec_001",
  "userId": "uid_123",
  "entryType": "free_input",
  "inputQuery": "요즘 불안하고 삶의 방향을 모르겠어요",
  "selectedThemeId": "anxiety",
  "selectedThemeLabel": "불안할 때 읽는 철학",
  "resolvedThemeIds": ["anxiety", "meaning_of_life"],
  "resolvedThemeLabels": [
    "불안할 때 읽는 철학",
    "삶의 방향을 잃었을 때 읽는 철학"
  ],
  "recommendedBooks": [
    {
      "bookId": "9780000000001",
      "title": "책 제목 A",
      "author": "저자 A",
      "oneLineSummary": "불안과 삶의 의미를 함께 생각하게 하는 입문서",
      "philosophicalContext": "실존과 선택의 문제를 비교적 쉽게 풀어가는 책",
      "entryDifficulty": "입문",
      "whyThisBook": "불안을 없애기보다 삶의 방향을 잃었을 때 어떤 질문을 가져야 하는지 생각하게 해줍니다.",
      "reasonTags": ["불안", "실존", "입문 가능"],
      "publisher": "출판사 A",
      "pubYear": 2022,
      "isbn": "9780000000001",
      "coverImage": "https://...",
      "sourceLink": "https://..."
    }
  ],
  "deviceType": "mobile",
  "locale": "ko-KR",
  "version": "v1.0",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

---

## 5.7 `recommendation_cache` (선택)

### 역할
- 동일/유사 입력에 대한 추천 결과 캐시
- 생성 비용 절감
- 응답 속도 개선

### 경로
`/recommendation_cache/{cacheKey}`

### 필드
- `cacheKey`
- `inputQuery`
- `themeId`
- `normalizedInput`
- `recommendedBooks`
- `reasonTags`
- `createdAt`
- `expiresAt`

### 초기 판단
- 꼭 필요하지 않음
- 트래픽이나 생성 비용이 커질 때 도입

---

## 5.8 `system_config` (선택)

### 역할
- 운영 플래그 관리
- 노출 설정 관리
- 실험 변수 관리

### 경로
`/system_config/{configId}`

### 예시 필드
- `configId`
- `visibleThemeCount`
- `themeGroupOrder`
- `allowFreeInput`
- `showReasonTags`
- `updatedAt`

---

## 6. Firestore 구조 요약

### 루트 컬렉션
- `/users/{uid}`
- `/themes/{themeId}`
- `/books/{bookId}`
- `/curator_config/{personaId}`
- `/interaction_logs/{eventId}`
- `/recommendation_cache/{cacheKey}` (선택)
- `/system_config/{configId}` (선택)

### 하위 컬렉션
- `/users/{uid}/recommendation_history/{historyId}`

---

## 7. 추천 처리 흐름과 조회 흐름

### 7.1 주제 선택형 흐름
1. `themes`에서 20개 주제 조회
2. 사용자가 주제 선택
3. `interaction_logs`에 선택 이벤트 기록
4. 주제명 + 관련 개념 기준으로 책 후보 검색
5. `books`에서 후보군 조회
6. `curator_config` 조회
7. 프롬프트 생성 및 추천 결과 반환
8. 추천 결과를 `users/{uid}/recommendation_history`에 저장
9. 결과 렌더 이벤트 기록

### 7.2 자유 입력형 흐름
1. 사용자가 자유 입력 제출
2. 제출 이벤트를 `interaction_logs`에 기록
3. `themes.relatedConcepts`, `themes.exampleQueries`와 비교
4. 가까운 Theme 2~3개 계산
5. Theme 후보 제시
6. 사용자가 선택하면 이후 주제 선택형 흐름으로 연결

### 7.3 추천 기록 조회 흐름
1. 로그인 사용자 UID 확인
2. `/users/{uid}/recommendation_history` 조회
3. `createdAt desc` 정렬
4. 필요 시 `selectedThemeId` 기준 필터

---

## 8. ConceptTag를 별도 컬렉션으로 둘지 여부

### 초기 권고
별도 컬렉션 없이 시작한다.

즉:
- `themes.relatedConcepts` 배열로 시작
- ConceptTag는 독립 컬렉션이 아니라 문자열 배열 수준으로 운영

### 별도 컬렉션으로 분리할 시점
- concept 기반 통계가 필요해짐
- concept 자체를 UI에 노출
- alias 관리가 복잡해짐
- 라우팅 품질 튜닝이 중요해짐

---

## 9. 추천 결과 저장 원칙

### 분석용 저장
- `interaction_logs`

### 사용자 조회용 저장
- `users/{uid}/recommendation_history`

### 원칙
- 추천 결과 1회 = 추천 히스토리 문서 1건
- 추천 결과는 사용자에게 보여주기 직전 또는 직후 저장
- 추천 당시 결과를 그대로 다시 보여주기 위해 일부 중복 저장 허용

---

## 10. 인덱스 권장안

### `themes`
- `isActive`
- `priorityOrder`

### `books`
- `isActive`
- `language`

### `interaction_logs`
- `eventType`
- `themeId`
- `createdAt`
- `sessionId`

### `users/{uid}/recommendation_history`
- `createdAt desc`
- `selectedThemeId + createdAt desc` (필요 시)

---

## 11. 보안 규칙 방향

### 기본 원칙
- 사용자는 자기 자신의 데이터만 읽고 쓸 수 있어야 한다

### 권장 규칙 개념
- `/users/{uid}`: `request.auth.uid == uid`
- `/users/{uid}/recommendation_history/{historyId}`: `request.auth.uid == uid`
- 운영용 루트 컬렉션(`themes`, `books`, `curator_config`)은 읽기 전용 또는 관리자 쓰기

---

## 12. 최소 구현안

가장 단순하게 시작하려면 아래만 있어도 됩니다.

### 반드시 구현
- `users`
- `themes`
- `books`
- `curator_config`
- `interaction_logs`
- `users/{uid}/recommendation_history`

### 나중에 추가
- `recommendation_cache`
- `system_config`
- `concept_tags` 별도 컬렉션

---

## 13. 권장 구현 순서

1. `themes` 스키마 확정 및 20개 주제 등록
2. `books` 스키마 확정 및 샘플 도서 저장
3. `curator_config` 작성
4. `users` 연동
5. `users/{uid}/recommendation_history` 저장 구현
6. `interaction_logs` 연결
7. 필요 시 캐시/운영 설정 추가

즉, 순서는 아래가 적절합니다.

**Firestore 스키마 → 출력 계약 → 프롬프트 → 로그 분석**

---

## 14. 최종 결론

이 MVP를 Firestore로 구현할 때는  
정교한 관계형 구조보다 단순한 문서 구조 + 비정규화 + 실시간 생성이 더 적합합니다.

현재 기준 필수 컬렉션은 아래 6개입니다.

- `users`
- `themes`
- `books`
- `curator_config`
- `interaction_logs`
- `users/{uid}/recommendation_history`

그리고 사용자 입장에서 중요한 기능은 아래 한 줄로 요약됩니다.

> 로그인한 사용자가 과거에 어떤 주제로 어떤 책을 추천받았는지  
> 사용자별 하위 컬렉션에서 시간순으로 다시 조회할 수 있어야 한다.
