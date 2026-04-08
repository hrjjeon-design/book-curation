# 철학 도서 큐레이션 MVP — 6단계 구현 명세서

버전: v1.0  
작성일: 2026-04-08

---

## 1. 목표

| 항목 | 설명 |
|------|------|
| Firestore Security Rules | 사용자 데이터 보호, 운영 컬렉션 읽기 전용 |
| 반응형 UI 점검 | 모바일/태블릿/PC 레이아웃 확인 |
| Vercel 배포 | 프로덕션 환경 배포 및 환경 변수 설정 |

---

## 2. Firestore Security Rules

### 파일: `firestore.rules` (프로젝트 루트)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 운영 컬렉션: 누구나 읽기 가능, 쓰기 불가
    match /themes/{themeId} {
      allow read: if true;
      allow write: if false;
    }

    match /books/{bookId} {
      allow read: if true;
      allow write: if false;
    }

    match /curator_config/{personaId} {
      allow read: if true;
      allow write: if false;
    }

    // interaction_logs: 서버에서만 쓰기 (클라이언트 접근 불가)
    match /interaction_logs/{eventId} {
      allow read, write: if false;
    }

    // users: 본인만 읽기/쓰기
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;

      // recommendation_history: 본인만 읽기/쓰기
      match /recommendation_history/{historyId} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

### 적용 방법
Firebase Console → Firestore → Rules 탭에 위 내용 붙여넣기 후 "게시"

### 주의사항
- `interaction_logs`, `books`, `themes`, `curator_config`는 모두 서버(Admin SDK)에서만 접근 → 클라이언트 deny가 정상 동작
- `users` 하위 컬렉션도 `request.auth.uid == uid` 조건 동일 적용됨

---

## 3. 반응형 UI 점검 체크리스트

안티그라비티가 아래 해상도에서 직접 확인합니다.

| 화면 | 해상도 기준 | 확인 항목 |
|------|------------|----------|
| 모바일 | 375px | 헤더 로그인 버튼, 검색창, 테마 타일 1열, BookCard |
| 태블릿 | 768px | 테마 타일 2열, BookCard 레이아웃 |
| PC | 1280px | 테마 타일 3~4열, max-w-4xl 여백 |

**주요 확인 포인트:**
- 헤더: 모바일에서 이름 텍스트 숨김 (`hidden sm:block`) 정상 동작 여부
- 검색창: 전체 너비 유지
- ThemeCandidatePanel: 모바일에서 카드 세로 배치
- RecommendationResult: BookCard 표지 이미지 영역 깨짐 없음
- 스크롤: `window.scrollTo(0, 0)` 추천 결과 전환 시 상단 이동

---

## 4. Vercel 배포

### 4.1 환경 변수 설정

Vercel 대시보드 → Project → Settings → Environment Variables에 아래 추가:

| 변수명 | 값 출처 |
|--------|--------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase 콘솔 → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase 콘솔 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase 콘솔 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase 콘솔 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase 콘솔 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase 콘솔 |
| `FIREBASE_PROJECT_ID` | Firebase 콘솔 |
| `FIREBASE_CLIENT_EMAIL` | Firebase 서비스 계정 키 |
| `FIREBASE_PRIVATE_KEY` | Firebase 서비스 계정 키 (줄바꿈 `\n` 포함) |
| `GEMINI_API_KEY` | Google AI Studio |

### 4.2 배포 방법

```bash
# Vercel CLI 사용 시
vercel --prod

# 또는 GitHub 연동 후 main 브랜치 push 자동 배포
```

### 4.3 Firebase 승인된 도메인 추가

Firebase Console → Authentication → Settings → 승인된 도메인  
→ Vercel 배포 URL 추가 (예: `your-app.vercel.app`)

---

## 5. 검증 기준

| 항목 | 확인 방법 |
|------|---------|
| Security Rules | Firebase 콘솔 Rules Playground에서 미인증 사용자의 `/users/{uid}` 쓰기 → deny 확인 |
| Security Rules | 인증 사용자가 본인 uid로 `/users/{uid}` 읽기 → allow 확인 |
| 반응형 | Chrome DevTools 모바일 뷰 3가지 해상도 육안 확인 |
| 배포 | Vercel URL에서 전체 플로우 동작 확인 (테마 선택 → 추천 → 로그인) |
| 환경 변수 | 배포 후 `/api/themes` 정상 응답 확인 |

---

## 6. `.gitignore` 확인 (배포 전)

아래 항목이 `.gitignore`에 포함되어 있는지 확인:

```
.env.local
*.pem
serviceAccountKey.json
```
