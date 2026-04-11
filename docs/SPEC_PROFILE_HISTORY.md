# 구현 지시서: #4 프로필 / 히스토리 페이지

> 구현 대상: 안티그라비티  
> 작성: Claude (설계·검증)  
> 작성일: 2026-04-11  
> 참고: `docs/DESIGN_PROFILE_HISTORY_PAGE.md` (원본 디자인 지시서)  
> 디자인 참고: `b_IerovQAnMVf.zip` (v0.dev 산출물)  
> 상태: 신규

---

## 1. 개요

로그인한 사용자가 과거 추천 이력을 다시 볼 수 있는 `/profile` 페이지를 만든다.  
v0.dev가 디자인한 컴포넌트 코드를 **기존 프로젝트 구조에 맞게** 통합 구현한다.

### 핵심 원칙

- v0.dev 코드의 **디자인(마크업·스타일)**을 최대한 그대로 사용
- **mock 데이터/mock 인증은 모두 제거** → 기존 Firebase Auth + `/api/history` API 연결
- v0.dev가 만든 별도 Header 컴포넌트는 사용하지 않음 → **기존 `app/layout.tsx` 헤더** 수정

---

## 2. 수정 파일 목록

| # | 파일 | 작업 | 신규/수정 |
|---|------|------|-----------|
| 1 | `app/profile/page.tsx` | 프로필 페이지 | **신규** |
| 2 | `components/history-card.tsx` | 이력 카드 컴포넌트 | **신규** |
| 3 | `components/history-empty.tsx` | 이력 없음 상태 | **신규** |
| 4 | `components/login-required.tsx` | 비로그인 상태 | **신규** |
| 5 | `components/auth-button.tsx` | "내 이력" 링크 추가 | 수정 |
| 6 | `app/page.tsx` | `?themeId=` 쿼리 파라미터 감지 (재추천) | 수정 |

**사용하지 않는 v0.dev 파일** (무시):
- `components/header.tsx` → 기존 `app/layout.tsx` 헤더 사용
- `components/auth-button.tsx` → 기존 auth-button 수정
- `app/page.tsx`, `app/results/page.tsx` → 기존 것 유지
- `components/ui/*` 중 프로젝트에 이미 있는 것 → 기존 것 사용

---

## 3. 상세 구현

### 3.1 `app/profile/page.tsx` (신규)

v0.dev 코드 기반으로 작성하되, mock을 실제 로직으로 교체한다.

```typescript
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User } from "firebase/auth"
import { onAuthChange, signInWithGoogle } from "@/lib/auth"
import { LoginRequired } from "@/components/login-required"
import { HistoryEmpty } from "@/components/history-empty"
import { HistoryCard } from "@/components/history-card"
import { Loader2 } from "lucide-react"
```

**상태 관리:**

```
user: User | null          — Firebase Auth 사용자
history: HistoryItem[]     — API에서 가져온 이력 배열
loading: boolean           — 로딩 중
```

**로직:**

1. `useEffect`에서 `onAuthChange` 구독 → `user` 상태 설정
2. `user`가 설정되면 `GET /api/history?uid={user.uid}` 호출
3. 응답의 `history` 배열을 상태에 저장
4. 각 항목을 `HistoryCard`로 렌더링

**레이아웃 (v0.dev 디자인 그대로):**

```jsx
<main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
  {loading ? (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ) : !user ? (
    <LoginRequired onLogin={() => signInWithGoogle()} />
  ) : (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h1 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
        내 추천 이력
      </h1>
      {history.length > 0 && (
        <p className="text-sm text-muted-foreground mb-8">
          지금까지 {history.length}번의 추천을 받았습니다
        </p>
      )}
      {history.length === 0 ? (
        <HistoryEmpty />
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <HistoryCard key={item.historyId} {...item} onReplay={handleReplay} />
          ))}
        </div>
      )}
    </div>
  )}
</main>
```

**handleReplay 구현:**

```typescript
const handleReplay = (themeId: string) => {
  router.push(`/?themeId=${themeId}`)
}
```

> **주의**: `<Header>` 컴포넌트를 사용하지 마세요.  
> 기존 `app/layout.tsx`의 헤더가 모든 페이지에 적용되므로, profile 페이지에서는 `<main>` 부분만 렌더링합니다.

---

### 3.2 `components/history-card.tsx` (신규)

**v0.dev 코드를 그대로 사용한다.** 변경 없음.

```typescript
export interface HistoryCardProps {
  historyId: string
  entryType: "theme_selection" | "free_input"
  inputQuery: string | null
  selectedThemeLabel: string | null
  selectedThemeId?: string | null
  recommendedBooks: { title: string; author: string }[]
  createdAt: string   // ISO string
  onReplay?: (themeId: string) => void
}
```

**디자인 요소 (v0.dev 원본 유지):**

- `bg-card border border-border rounded-lg p-5`
- 날짜: `text-xs text-muted-foreground`
- 진입 경로: `text-sm text-muted-foreground` + 주제명은 `text-foreground`
- 자유 검색이면 추가 줄: `"검색어"` → `"주제명" 주제 선택`
- 책 목록: `BookOpen` 아이콘 + 제목 (모바일), 제목 + 저자 (데스크톱 `hidden sm:inline`)
- 재생 버튼: `Play` 아이콘, 우상단, `variant="ghost" size="icon"`

**API 응답 → Props 매핑:**

| API 필드 | Props |
|----------|-------|
| `historyId` | `historyId` |
| `entryType` | `entryType` |
| `inputQuery` | `inputQuery` |
| `selectedThemeLabel` | `selectedThemeLabel` |
| `selectedThemeId` | `selectedThemeId` |
| `recommendedBooks[].title` | `recommendedBooks[].title` |
| `recommendedBooks[].author` | `recommendedBooks[].author` |
| `createdAt` (ISO string) | `createdAt` |

---

### 3.3 `components/history-empty.tsx` (신규)

**v0.dev 코드를 그대로 사용한다.** 변경 없음.

- dashed border, 중앙 정렬
- "주제 둘러보기" 버튼 → `<Link href="/">`
- `Button` 컴포넌트 사용 (`variant="outline"`, `asChild`)

---

### 3.4 `components/login-required.tsx` (신규)

**v0.dev 코드를 그대로 사용하되**, `onLogin` prop을 통해 기존 `signInWithGoogle()` 함수를 호출한다.

- `BookOpen` 아이콘 (큰 사이즈, `text-muted-foreground/40`)
- Google 아이콘 SVG + "Google로 로그인" 버튼
- `onLogin` prop: 호출 시 `signInWithGoogle()` 실행

---

### 3.5 `components/auth-button.tsx` (수정)

기존 auth-button에 "내 이력" 링크를 추가한다.

**현재 (line 34-54, 로그인 상태):**

```tsx
<div className="flex items-center gap-3">
  {/* 사진 */}
  {/* 이름 */}
  {/* 로그아웃 버튼 */}
</div>
```

**수정 후:**

```tsx
import Link from "next/link"
import { Clock } from "lucide-react"

// 로그인 상태 렌더링 부분 수정:
<div className="flex items-center gap-2 sm:gap-3">
  {user.photoURL && (
    <img
      src={user.photoURL}
      alt={user.displayName ?? ""}
      className="w-7 h-7 rounded-full"
    />
  )}
  <span className="text-sm text-muted-foreground hidden sm:block">
    {user.displayName}
  </span>

  {/* 추가: 데스크톱 - 텍스트 링크 */}
  <Link
    href="/profile"
    className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
  >
    내 이력
  </Link>

  {/* 추가: 모바일 - 아이콘만 */}
  <Link
    href="/profile"
    className="sm:hidden text-muted-foreground hover:text-foreground transition-colors"
    aria-label="내 이력"
  >
    <Clock className="w-4 h-4" />
  </Link>

  <button
    onClick={() => signOutUser()}
    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
  >
    로그아웃
  </button>
</div>
```

**요약: `로그아웃` 버튼 앞에 2개 요소 추가**
1. 데스크톱: "내 이력" 텍스트 링크 (`hidden sm:inline`)
2. 모바일: Clock 아이콘 (`sm:hidden`)

---

### 3.6 `app/page.tsx` (수정) — 재추천 쿼리 파라미터 처리

프로필 페이지에서 "다시 추천받기" 클릭 시 `/?themeId=xxx`로 이동한다.  
메인 페이지에서 이 쿼리 파라미터를 감지하여 자동으로 추천을 시작해야 한다.

**추가할 로직:**

```typescript
import { useSearchParams } from "next/navigation"

// Home 컴포넌트 내부:
const searchParams = useSearchParams()

useEffect(() => {
  const themeId = searchParams.get("themeId")
  if (themeId && !recommending && !recommendation) {
    handleTopicClick(themeId)
  }
}, [searchParams])
```

> **주의**: `useSearchParams`는 `Suspense` 바운더리가 필요할 수 있습니다.  
> Next.js App Router에서 경고가 나면 `<Suspense>` 래핑을 추가하세요.

---

## 4. 데이터 흐름 정리

```
[프로필 페이지 진입]
  ├── onAuthChange → user 확인
  │   ├── null → LoginRequired 표시
  │   └── user → GET /api/history?uid={uid}
  │       ├── history.length === 0 → HistoryEmpty 표시
  │       └── history.length > 0 → HistoryCard × N 표시
  │
  └── [재생 버튼 클릭]
      └── router.push(`/?themeId=${selectedThemeId}`)
          └── 메인 페이지에서 themeId 감지 → handleTopicClick 자동 실행
```

---

## 5. 금지사항

1. **Firestore SDK를 클라이언트에서 직접 호출하지 않음** → `/api/history` API만 사용
2. **새로운 API 엔드포인트 추가하지 않음** → 기존 `GET /api/history?uid={uid}` 사용
3. **v0.dev의 `components/header.tsx`를 사용하지 않음** → 기존 `app/layout.tsx` 헤더 사용
4. **v0.dev의 mock 데이터/mock 인증 코드를 포함하지 않음**
5. **이력 삭제 기능 없음** (MVP 범위 밖)
6. **페이지네이션 없음** — API 기본값 최근 20건만 표시

---

## 6. 체크리스트

구현 완료 후 아래 항목을 점검해 주세요:

| # | 항목 | 확인 |
|---|------|------|
| 1 | `/profile` 페이지가 정상 렌더링되는가 | |
| 2 | 비로그인 시 LoginRequired 화면이 표시되는가 | |
| 3 | LoginRequired에서 Google 로그인 버튼이 작동하는가 (`signInWithGoogle`) | |
| 4 | 로그인 후 이력이 없으면 HistoryEmpty 화면이 표시되는가 | |
| 5 | 로그인 후 이력이 있으면 HistoryCard 목록이 표시되는가 | |
| 6 | HistoryCard에 날짜, 진입 경로, 주제명, 책 목록이 올바르게 표시되는가 | |
| 7 | 자유 검색(free_input) 이력에 검색어와 주제 선택 경로가 표시되는가 | |
| 8 | 재생(Play) 버튼 클릭 시 `/?themeId=xxx`로 이동하는가 | |
| 9 | 메인 페이지에서 `?themeId=xxx` 쿼리 파라미터로 자동 추천이 시작되는가 | |
| 10 | 헤더에 "내 이력" 링크가 표시되는가 (데스크톱: 텍스트, 모바일: Clock 아이콘) | |
| 11 | "내 이력" 클릭 시 `/profile`로 이동하는가 | |
| 12 | 반응형: 모바일에서 책 목록에 제목만, 데스크톱에서 제목+저자 표시되는가 | |
| 13 | mock 데이터/mock 인증 코드가 없는가 (Firebase Auth + API 사용) | |
| 14 | `npx tsc --noEmit` 타입 에러 없는가 | |

---

## 7. v0.dev 파일 참조표

v0.dev 산출물(`b_IerovQAnMVf.zip`) 중 사용할 파일과 참조 방법:

| v0.dev 파일 | 사용 여부 | 참고 |
|-------------|-----------|------|
| `app/profile/page.tsx` | **참조** | 레이아웃·구조만 참조, mock 제거 후 Firebase Auth 연결 |
| `components/history-card.tsx` | **그대로 사용** | Props 인터페이스, 디자인 모두 사용 |
| `components/history-empty.tsx` | **그대로 사용** | 변경 없음 |
| `components/login-required.tsx` | **그대로 사용** | `onLogin` prop으로 `signInWithGoogle` 전달 |
| `components/header.tsx` | **사용 안 함** | 기존 layout.tsx 헤더 유지 |
| `components/auth-button.tsx` | **디자인만 참조** | 기존 auth-button에 "내 이력" 링크 추가 시 참고 |
| `components/ui/spinner.tsx` | **사용 안 함** | `Loader2` (lucide) 사용 |
| 나머지 `components/ui/*` | **사용 안 함** | 기존 프로젝트의 shadcn/ui 사용 |
