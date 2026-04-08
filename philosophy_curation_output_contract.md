# 철학 도서 큐레이션 MVP - 출력 계약(Output Contract) MD v1.0

## 1. 문서 목적

이 문서는 철학 도서 큐레이션 MVP에서 AI가 생성해야 하는 **최종 출력 형식**을 정의합니다.

이 문서의 목적은 다음과 같습니다.

- AI 출력 형식을 고정한다
- UI 렌더링 구조를 안정화한다
- 추천 히스토리 저장 구조와 맞춘다
- 프롬프트 설계 기준을 제공한다

즉, 이 문서는 **프롬프트보다 먼저 정해지는 입출력 계약 문서**입니다.

---

## 2. 적용 범위

이 출력 계약은 아래 상황에 적용됩니다.

- 주제 선택형 추천
- 자유 입력형 추천
- 추천 결과 생성 성공
- 추천 결과 생성 실패 또는 재선택 유도

---

## 3. 출력 계약 원칙

### 3.1 JSON 우선
최종 출력은 항상 **구조화된 JSON 객체**를 기준으로 합니다.

### 3.2 UI 직접 사용 가능해야 함
출력값은 별도 후처리를 최소화하고, 프런트엔드에서 바로 렌더링 가능해야 합니다.

### 3.3 히스토리 저장 가능해야 함
출력 구조는 `users/{uid}/recommendation_history/{historyId}` 저장 구조와 최대한 호환되어야 합니다.

### 3.4 설명은 짧고 일관되어야 함
각 책 설명은 길게 늘어지지 않고, 고정된 필드별 역할이 분명해야 합니다.

### 3.5 실패도 구조화되어야 함
추천 실패 또는 해석 불확실 상황도 자유 텍스트가 아니라 정해진 구조로 반환해야 합니다.

---

## 4. 상위 응답 구조

최상위 응답 객체는 아래 구조를 따릅니다.

- `status`
- `entryType`
- `inputQuery`
- `selectedTheme`
- `resolvedThemes`
- `introMessage`
- `books`
- `fallbackThemes`
- `generatedAt`

---

## 5. 최상위 필드 정의

### 5.1 `status`
응답 상태를 나타냅니다.

허용값:
- `success`
- `need_theme_selection`
- `no_result`
- `error`

#### 의미
- `success`: 추천 결과 생성 성공
- `need_theme_selection`: 자유 입력 해석은 되었지만, 먼저 가까운 주제를 고르게 해야 함
- `no_result`: 적절한 추천 결과를 만들지 못함
- `error`: 시스템 또는 생성 오류

---

### 5.2 `entryType`
사용자 진입 방식을 나타냅니다.

허용값:
- `theme_selection`
- `free_input`
- `book_or_author_entry`

---

### 5.3 `inputQuery`
사용자가 직접 입력한 질문입니다.

타입:
- `string | null`

설명:
- 테마 선택형 추천이면 `null`일 수 있습니다.
- 자유 입력형이면 원문을 보존합니다.

---

### 5.4 `selectedTheme`
최종 추천 생성에 사용된 대표 주제입니다.

타입:
- `object | null`

구조:
- `themeId`: string
- `label`: string
- `group`: string

예시:
```json
{
  "themeId": "anxiety",
  "label": "불안할 때 읽는 철학",
  "group": "생활형"
}
```

---

### 5.5 `resolvedThemes`
AI가 해석 과정에서 연결한 관련 주제 목록입니다.

타입:
- `object[]`

각 원소 구조:
- `themeId`: string
- `label`: string

예시:
```json
[
  {
    "themeId": "anxiety",
    "label": "불안할 때 읽는 철학"
  },
  {
    "themeId": "meaning_of_life",
    "label": "삶의 방향을 잃었을 때 읽는 철학"
  }
]
```

---

### 5.6 `introMessage`
추천 화면 최상단에 노출할 짧은 안내 문장입니다.

타입:
- `string | null`

설명:
- 사용자의 질문을 어떻게 해석했는지 짧게 설명합니다.
- 추천자 페르소나의 톤을 유지합니다.

예시:
- `이 질문은 불안을 없애는 책보다, 불안을 견디며 삶의 방향을 다시 생각하게 하는 철학과 가깝습니다.`

---

### 5.7 `books`
추천된 책 목록입니다.

타입:
- `object[]`

원칙:
- `status = success`일 때만 사용
- 초기 MVP에서는 기본 3권 권장
- 최대 5권 이내 권장

---

### 5.8 `fallbackThemes`
즉시 추천보다 먼저 다시 고르게 해야 할 때 제안하는 주제 목록입니다.

타입:
- `object[]`

사용 조건:
- `status = need_theme_selection`

각 원소 구조:
- `themeId`: string
- `label`: string
- `group`: string

---

### 5.9 `generatedAt`
추천 결과 생성 시각입니다.

타입:
- `string` (ISO 8601) 또는 타임스탬프 문자열

설명:
- 프런트 표시용
- 저장 시 `createdAt`과 별도로 활용 가능

---

## 6. `books[]` 객체 구조

각 추천 책 객체는 아래 구조를 따릅니다.

### 필수 필드
- `bookId`
- `title`
- `author`
- `publisher`
- `pubYear`
- `isbn`
- `coverImage`
- `sourceLink`
- `oneLineSummary`
- `philosophicalContext`
- `entryDifficulty`
- `whyThisBook`
- `reasonTags`

---

### 6.1 `bookId`
타입:
- `string | null`

설명:
- 내부 `books` 컬렉션의 식별자
- 없으면 `null` 허용

---

### 6.2 `title`
타입:
- `string`

---

### 6.3 `author`
타입:
- `string`

---

### 6.4 `publisher`
타입:
- `string | null`

---

### 6.5 `pubYear`
타입:
- `number | null`

---

### 6.6 `isbn`
타입:
- `string | null`

---

### 6.7 `coverImage`
타입:
- `string | null`

설명:
- UI 카드 이미지용

---

### 6.8 `sourceLink`
타입:
- `string | null`

설명:
- 상세 정보 또는 외부 연결용

---

### 6.9 `oneLineSummary`
타입:
- `string`

설명:
- 책을 한 줄로 설명하는 문장
- 너무 마케팅 문구처럼 쓰지 않음

예시:
- `불안과 선택의 문제를 실존의 관점에서 차분히 생각하게 하는 책`

---

### 6.10 `philosophicalContext`
타입:
- `string`

설명:
- 이 책이 어떤 철학적 문제의식, 전통, 논의 맥락에 놓여 있는지 설명

예시:
- `실존과 선택의 문제를 중심으로, 삶의 의미를 어떻게 묻는지 생각하게 하는 흐름에 놓인 책입니다.`

---

### 6.11 `entryDifficulty`
타입:
- `string`

허용값 예시:
- `입문`
- `중간`
- `심화`

설명:
- 입문 난이도 표시
- UI 배지처럼 활용 가능

---

### 6.12 `whyThisBook`
타입:
- `string`

설명:
- 사용자의 이번 질문에 왜 맞는지 설명
- 책별/주제별 커스텀 핵심 필드

예시:
- `불안을 없애는 해답보다, 흔들리는 상황에서 어떤 질문을 가져야 하는지 생각하게 해준다는 점에서 이 질문과 잘 맞습니다.`

---

### 6.13 `reasonTags`
타입:
- `string[]`

설명:
- 신뢰 보강용 근거 태그
- UI에서 짧은 칩 형태로 표시 가능

예시:
```json
["불안", "실존", "입문 가능"]
```

---

## 7. 성공 응답 구조

### 조건
- `status = success`
- `books.length >= 1`

### 예시
```json
{
  "status": "success",
  "entryType": "free_input",
  "inputQuery": "요즘 불안하고 삶의 방향을 모르겠어요",
  "selectedTheme": {
    "themeId": "anxiety",
    "label": "불안할 때 읽는 철학",
    "group": "생활형"
  },
  "resolvedThemes": [
    {
      "themeId": "anxiety",
      "label": "불안할 때 읽는 철학"
    },
    {
      "themeId": "meaning_of_life",
      "label": "삶의 방향을 잃었을 때 읽는 철학"
    }
  ],
  "introMessage": "이 질문은 불안을 없애는 책보다, 불안을 견디며 삶의 방향을 다시 생각하게 하는 철학과 가깝습니다.",
  "books": [
    {
      "bookId": "9780000000001",
      "title": "책 제목 A",
      "author": "저자 A",
      "publisher": "출판사 A",
      "pubYear": 2022,
      "isbn": "9780000000001",
      "coverImage": "https://...",
      "sourceLink": "https://...",
      "oneLineSummary": "불안과 삶의 의미를 함께 생각하게 하는 입문서",
      "philosophicalContext": "실존과 선택의 문제를 비교적 쉽게 풀어가는 책입니다.",
      "entryDifficulty": "입문",
      "whyThisBook": "불안을 없애기보다 삶의 방향을 잃었을 때 어떤 질문을 가져야 하는지 생각하게 해줍니다.",
      "reasonTags": ["불안", "실존", "입문 가능"]
    }
  ],
  "fallbackThemes": [],
  "generatedAt": "2026-04-07T12:00:00Z"
}
```

---

## 8. 재선택 유도 응답 구조

### 조건
- `status = need_theme_selection`
- 자유 입력을 받았지만, 바로 책 추천보다 먼저 가까운 주제를 고르게 하는 편이 적절할 때

### 원칙
- `books`는 빈 배열
- `fallbackThemes`는 2~3개 권장

### 예시
```json
{
  "status": "need_theme_selection",
  "entryType": "free_input",
  "inputQuery": "요즘 너무 허무하고 뭘 해야 할지 모르겠어요",
  "selectedTheme": null,
  "resolvedThemes": [],
  "introMessage": "이 질문은 여러 방향으로 해석될 수 있어, 먼저 가까운 주제를 고르면 더 잘 맞는 책을 추천할 수 있습니다.",
  "books": [],
  "fallbackThemes": [
    {
      "themeId": "meaning_of_life",
      "label": "삶의 방향을 잃었을 때 읽는 철학",
      "group": "생활형"
    },
    {
      "themeId": "happiness",
      "label": "행복하게 산다는 게 무엇인지 묻는 철학",
      "group": "생활형"
    },
    {
      "themeId": "human_nature",
      "label": "인간이란 무엇인지 묻게 하는 철학",
      "group": "관심사형"
    }
  ],
  "generatedAt": "2026-04-07T12:00:00Z"
}
```

---

## 9. 결과 없음 응답 구조

### 조건
- `status = no_result`

### 원칙
- 추천 품질이 낮을 것으로 예상될 때 억지 추천하지 않음
- 가능한 경우 `fallbackThemes`를 같이 제안할 수 있음

### 예시
```json
{
  "status": "no_result",
  "entryType": "free_input",
  "inputQuery": "매우 특수한 질문 예시",
  "selectedTheme": null,
  "resolvedThemes": [],
  "introMessage": "지금 입력만으로는 신뢰할 만한 추천을 만들기 어려웠습니다. 아래 주제 중 하나로 다시 시작하면 더 정확한 추천이 가능합니다.",
  "books": [],
  "fallbackThemes": [
    {
      "themeId": "start_philosophy",
      "label": "철학을 처음 시작하고 싶을 때",
      "group": "입문·출발형"
    }
  ],
  "generatedAt": "2026-04-07T12:00:00Z"
}
```

---

## 10. 오류 응답 구조

### 조건
- `status = error`

### 원칙
- 내부 오류나 생성 오류 발생 시 사용
- UI에서는 일반 오류 메시지로 변환 가능

### 예시
```json
{
  "status": "error",
  "entryType": "free_input",
  "inputQuery": "사용자 입력",
  "selectedTheme": null,
  "resolvedThemes": [],
  "introMessage": "추천을 준비하는 중 문제가 발생했습니다. 다시 시도해 주세요.",
  "books": [],
  "fallbackThemes": [],
  "generatedAt": "2026-04-07T12:00:00Z"
}
```

---

## 11. 저장용 변환 원칙

이 출력 구조는 추천 히스토리 저장 시 아래처럼 변환 가능해야 합니다.

### `selectedTheme`
→
- `selectedThemeId`
- `selectedThemeLabel`

### `resolvedThemes`
→
- `resolvedThemeIds`
- `resolvedThemeLabels`

### `books[]`
→
- `recommendedBooks[]`

즉, 추천 결과 출력 JSON과 추천 히스토리 저장 구조는 거의 1:1 대응해야 합니다.

---

## 12. UI 렌더링 원칙

프런트엔드는 아래 규칙으로 이 구조를 사용합니다.

### `status = success`
- `introMessage` 노출
- `books[]` 카드 렌더링

### `status = need_theme_selection`
- `introMessage` 노출
- `fallbackThemes[]` 버튼/타일 렌더링

### `status = no_result`
- 안내 메시지 노출
- 가능하면 `fallbackThemes[]` 렌더링

### `status = error`
- 일반 오류 화면 또는 재시도 UI 표시

---

## 13. 필수성 요약

### 항상 있어야 하는 필드
- `status`
- `entryType`
- `inputQuery`
- `selectedTheme`
- `resolvedThemes`
- `introMessage`
- `books`
- `fallbackThemes`
- `generatedAt`

### `status = success`일 때 사실상 필수
- `books[0].title`
- `books[0].author`
- `books[0].oneLineSummary`
- `books[0].philosophicalContext`
- `books[0].entryDifficulty`
- `books[0].whyThisBook`
- `books[0].reasonTags`

---

## 14. 최종 결론

이 출력 계약은 아래 원칙으로 요약됩니다.

> 추천 결과는 항상 구조화된 JSON으로 반환하며,
> 성공 시에는 추천 책 목록과 설명을,
> 재선택이 필요할 때는 가까운 주제를,
> 실패 시에는 그에 맞는 안내 구조를 반환한다.

즉, 핵심은 아래 4가지입니다.

- 출력 형식 고정
- UI 직접 사용 가능
- 추천 히스토리 저장 구조와 호환
- 실패 케이스도 구조화
