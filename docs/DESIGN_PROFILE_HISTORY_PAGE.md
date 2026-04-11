# 디자인 지시서: #4 프로필 / 히스토리 페이지

> 구현 대상: v0.dev (dev0)
> 작성: Claude (설계)
> 작성일: 2026-04-11
> 기술 스택: Next.js App Router + Tailwind CSS + shadcn/ui
> 상태: 신규

---

## 1. 개요

로그인한 사용자가 자신의 추천 이력을 다시 볼 수 있는 프로필/히스토리 페이지를 만든다.
현재 추천 이력은 Firestore에 저장되고 있으나(`/api/history`), 이를 보여주는 UI가 없다.

---

## 2. 페이지 구조

### 2.1 라우트

```
/profile
```

- 로그인 필수 페이지
- 비로그인 시 로그인 유도 화면 표시

### 2.2 레이아웃 위치

기존 `app/layout.tsx` 헤더바의 사용자 이름/로그아웃 영역에서 프로필 페이지로의 진입점 추가.

---

## 3. 화면 구성

### 3.1 비로그인 상태

```
┌─────────────────────────────────────┐
│  철학 도서 큐레이션        로그인    │ ← 기존 헤더
├─────────────────────────────────────┤
│                                     │
│         📚                          │
│                                     │
│    로그인하면 추천 이력을            │
│    확인할 수 있습니다               │
│                                     │
│    [ Google로 로그인 ]              │
│                                     │
└─────────────────────────────────────┘
```

### 3.2 로그인 상태 — 이력 없음

```
┌─────────────────────────────────────┐
│  철학 도서 큐레이션   [프로필] 로그아웃│
├─────────────────────────────────────┤
│                                     │
│  내 추천 이력                       │
│                                     │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐   │
│  │                              │   │
│  │  아직 추천 이력이 없습니다    │   │
│  │  주제를 선택하면 추천 이력이  │   │
│  │  여기에 쌓입니다             │   │
│  │                              │   │
│  │  [ 주제 둘러보기 ]           │   │
│  │                              │   │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘   │
└─────────────────────────────────────┘
```

### 3.3 로그인 상태 — 이력 있음

```
┌─────────────────────────────────────┐
│  철학 도서 큐레이션   [프로필] 로그아웃│
├─────────────────────────────────────┤
│                                     │
│  내 추천 이력                       │
│  지금까지 3번의 추천을 받았습니다    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 4월 10일                    │    │
│  │ 주제 선택 · "삶의 의미와 목적"│    │
│  │                             │    │
│  │  📖 소피의 세계              │    │
│  │  📖 존재와 시간              │    │
│  │  📖 차라투스트라는 이렇게 말했다│   │
│  │                        [▶]  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 4월 9일                     │    │
│  │ 자유 검색 · "불안을 다루는 책" │   │
│  │ → "실존주의와 불안" 주제 선택  │   │
│  │                             │    │
│  │  📖 불안의 개념              │    │
│  │  📖 존재와 무                │    │
│  │  📖 죽음에 이르는 병          │    │
│  │                        [▶]  │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

---

## 4. 컴포넌트 설계

### 4.1 신규 파일 목록

| 파일 | 용도 |
|------|------|
| `app/profile/page.tsx` | 프로필 페이지 (메인) |
| `components/history-card.tsx` | 이력 카드 1건 |
| `components/history-empty.tsx` | 이력 없음 상태 |
| `components/login-required.tsx` | 비로그인 상태 |

### 4.2 `app/profile/page.tsx`

```
"use client" 페이지

상태:
- user: Firebase Auth 사용자 (null이면 비로그인)
- history: 추천 이력 배열
- loading: 로딩 중

로직:
1. auth.currentUser 확인
2. 로그인 상태면 GET /api/history?uid={uid} 호출
3. 결과를 history 상태에 저장
4. 각 이력을 HistoryCard로 렌더링

레이아웃:
- max-w-2xl mx-auto (메인 페이지와 동일한 너비)
- px-4 sm:px-6 lg:px-8 py-12
```

### 4.3 `components/history-card.tsx`

한 건의 추천 이력을 표시하는 카드.

**Props:**

```typescript
interface HistoryCardProps {
  historyId: string
  entryType: "theme_selection" | "free_input"
  inputQuery: string | null
  selectedThemeLabel: string | null
  recommendedBooks: {
    title: string
    author: string
  }[]
  createdAt: string // ISO string
  onReplay?: (historyId: string) => void
}
```

**표시 내용:**

| 필드 | 표시 형식 |
|------|-----------|
| `createdAt` | "4월 10일" (같은 해면 연도 생략) |
| `entryType` | "주제 선택" 또는 "자유 검색" |
| `inputQuery` | 자유 검색인 경우만 표시: `"불안을 다루는 책"` |
| `selectedThemeLabel` | 선택한 주제명 |
| `recommendedBooks` | 책 제목 목록 (제목 + 저자만, 간략하게) |

**디자인:**

```
- bg-card border border-border rounded-lg p-5
- 날짜: text-xs text-muted-foreground
- 진입 경로: text-sm text-muted-foreground (주제 선택 · "주제명")
- 자유 검색이면 추가 줄: → "주제명" 주제 선택
- 책 목록: text-sm, 각 책 앞에 BookOpen 아이콘 (lucide)
- 우하단: 재생 버튼 (Play 아이콘, 해당 주제로 다시 추천받기)
```

### 4.4 `components/login-required.tsx`

```typescript
interface LoginRequiredProps {
  message?: string
}
```

- 중앙 정렬
- BookOpen 아이콘 (큰 사이즈, text-muted-foreground/40)
- 안내 문구
- Google 로그인 버튼 (기존 AuthButton의 로그인 로직 재사용)

### 4.5 `components/history-empty.tsx`

- 중앙 정렬, dashed border
- 안내 문구 + "주제 둘러보기" 버튼 (→ `/` 이동)

---

## 5. 헤더 수정

**파일**: `app/layout.tsx` + `components/auth-button.tsx`

### 현재

```
철학 도서 큐레이션    [사진] 홍길동  로그아웃
```

### 수정 후

```
철학 도서 큐레이션    [사진] 홍길동  내 이력  로그아웃
```

`auth-button.tsx`에서 로그인 상태일 때 "내 이력" 링크 추가:

```typescript
// 로그인 상태 (기존 line 34-54 내부)
import Link from "next/link"

// 수정: 로그아웃 버튼 앞에 추가
<Link
  href="/profile"
  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
>
  내 이력
</Link>
```

---

## 6. 데이터 흐름

### API (기존, 수정 불필요)

**GET** `/api/history?uid={uid}`

응답 구조 (현재 구현 기준):

```json
{
  "history": [
    {
      "historyId": "abc123",
      "userId": "uid",
      "entryType": "theme_selection",
      "inputQuery": null,
      "selectedThemeId": "theme_001",
      "selectedThemeLabel": "삶의 의미와 목적",
      "resolvedThemeIds": ["theme_001"],
      "resolvedThemeLabels": ["삶의 의미와 목적"],
      "recommendedBooks": [
        {
          "title": "소피의 세계",
          "author": "요슈타인 가아더",
          "bookId": "9788970120001",
          "oneLineSummary": "...",
          "entryDifficulty": "입문",
          "philosophicalContext": "...",
          "whyThisBook": "...",
          "reasonTags": ["#철학입문", "#서양철학사"]
        }
      ],
      "createdAt": "2026-04-10T09:30:00.000Z",
      "updatedAt": "2026-04-10T09:30:00.000Z"
    }
  ]
}
```

### 재추천 (onReplay)

이력 카드의 재생 버튼 클릭 시:
1. `selectedThemeId`를 사용하여 `/` 페이지로 이동
2. 자동으로 해당 주제의 추천을 시작

구현 방식: `router.push(`/?themeId=${selectedThemeId}`)` + 메인 페이지에서 쿼리 파라미터 감지

---

## 7. 반응형 디자인

| 요소 | 모바일 (<768px) | 데스크톱 |
|------|-----------------|----------|
| 컨테이너 | px-4 | max-w-2xl mx-auto px-8 |
| 이력 카드 | 세로 풀폭 | 동일 |
| 헤더 "내 이력" | 아이콘만 (Clock 아이콘) | 텍스트 "내 이력" |
| 책 목록 | 제목만 | 제목 + 저자 |

---

## 8. 스타일 가이드

기존 프로젝트 톤을 따른다:

- **색상**: `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border` (shadcn/ui 토큰)
- **라운딩**: `rounded-lg` (카드), `rounded-xl` (입력 필드)
- **애니메이션**: `animate-in fade-in slide-in-from-bottom-4 duration-500` (진입 시)
- **폰트**: Geist (시스템에 이미 설정됨)
- **아이콘**: lucide-react만 사용

---

## 9. 금지사항

- Firestore SDK를 클라이언트에서 직접 호출하지 않음 → `/api/history` API만 사용
- 새로운 API 엔드포인트 추가하지 않음 (기존 `/api/history` GET으로 충분)
- 프로필 페이지에서 사용자 정보 수정 기능 없음 (MVP 범위 밖)
- 이력 삭제 기능 없음 (MVP 범위 밖)
- 페이지네이션 없음 — 최근 20건만 표시 (API 기본값)

---

## 10. 디자인 참고 — 현재 앱 톤

현재 메인 페이지의 디자인 특징:

- 미니멀하고 여백이 넉넉한 레이아웃
- 어두운 배경에 밝은 텍스트 (다크모드 기본)
- 카드형 UI (border + bg-card)
- 주제 타일: `rounded-xl`, `hover:border-primary/40`
- 추천 결과: `divide-y` 구분선, 표지+텍스트 가로 배치
- "주제 선택으로 돌아가기" 같은 네비게이션은 ArrowLeft 아이콘 + 텍스트

프로필 페이지도 이 톤과 동일하게 디자인해야 한다.
