# 구현 명세서: 사전 캐시 풀 + 더 보기 기능

## 1. 개요

### 목적
- 도서 추천 응답 속도를 11~28초에서 3~6초로 단축 (약 70% 개선)
- "다른 책도 보기" 기능으로 추천 탐색 범위 확대

### 변경 범위
| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `scripts/build-theme-cache.ts` | 신규 | 주제별 캐시 풀 구축 스크립트 |
| `app/api/recommend/route.ts` | 수정 | 캐시 우선 조회 + excludeIsbns 파라미터 |
| `components/recommendation-result.tsx` | 수정 | "다른 책도 보기" 버튼 추가 |
| `app/page.tsx` | 수정 | handleShowMore 로직, 상태 관리 |
| `package.json` | 수정 | `build-cache` 스크립트 추가 |

---

## 2. 아키텍처 변경

### 기존 흐름 (매 요청마다 11~28초)
```
사용자 → Gemini 후보 10권 생성 (3~8초)
       → 국립도서관 API 검증 (5~15초)
       → Gemini 3권 추천 + 스트리밍 (3~5초)
```

### 변경 흐름 (캐시 히트 시 3~6초)
```
사용자 → Firestore theme_books 캐시 조회 (0.3초)
       → Gemini 3권 추천 + 스트리밍 (3~5초)

캐시 미스 시 → 기존 흐름으로 폴백
```

---

## 3. Firestore 스키마

### 신규 컬렉션: `theme_books`

```typescript
// Document ID: themeId (예: "anxiety")
{
  themeId: string          // "anxiety"
  themeName: string        // "불안할 때 읽는 철학"
  verifiedBooks: [         // 검증 완료된 책 목록 (15~20권)
    {
      title: string
      author: string
      publisher: string
      pubYear: number
      isbn: string
      coverImage: string | null
      description: string | null
    }
  ]
  totalCount: number       // verifiedBooks 개수
  cachedAt: Timestamp      // 캐시 생성/갱신 시각
}
```

---

## 4. 캐시 구축 스크립트

### 실행 방법
```bash
# 전체 주제 캐시 구축
npm run build-cache

# 특정 주제만 구축
npm run build-cache -- anxiety
```

### 동작
1. Firestore에서 활성 주제 목록 조회
2. 주제별로:
   - 기존 캐시가 7일 이내이고 10권 이상이면 스킵
   - Gemini에 **20권** 후보 요청 (기존 10권에서 확대)
   - 국립도서관 API로 검증 (6초 타임아웃)
   - ISBN 기준 중복 제거
   - `theme_books` 컬렉션에 저장
   - 개별 책도 `books` 컬렉션에 캐시
3. 주제 간 2초 딜레이 (API 스로틀링 방지)

### 갱신 정책
- 권장: 주 1회 `npm run build-cache` 실행
- 캐시 유효기간: 7일 (스크립트가 자동 판단)

---

## 5. API 변경: `/api/recommend`

### 추가된 쿼리 파라미터
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `excludeIsbns` | string (쉼표 구분) | 이미 추천한 책 ISBN 목록. 캐시에서 제외 |

### 동작 변경
1. `theme_books/{themeId}` 캐시 문서 조회
2. 캐시 존재 시:
   - `excludeIsbns`에 해당하는 책 필터링
   - 남은 책으로 Step 3(Gemini 추천) 직행
3. 캐시 미존재 또는 풀 고갈 시:
   - 기존 Step 1(Gemini 후보 생성) + Step 2(국립도서관 검증) 실행
   - `excludeIsbns`를 Gemini 프롬프트에도 전달

---

## 6. 프론트엔드: "다른 책도 보기"

### 상태 추가 (page.tsx)
```typescript
const [loadingMore, setLoadingMore] = useState(false)
const [seenBookIsbns, setSeenBookIsbns] = useState<string[]>([])
const [currentThemeId, setCurrentThemeId] = useState<string | null>(null)
```

### handleShowMore 동작
1. 현재까지 본 ISBN을 `excludeIsbns`로 전달
2. `/api/recommend?themeId={id}&excludeIsbns={isbns}` 호출
3. 응답 받은 새 3권을 기존 목록 뒤에 추가 (누적)
4. 새 ISBN을 `seenBookIsbns`에 추가

### UI (recommendation-result.tsx)
- 추천 완료 후 하단에 "다른 책도 보기" 버튼 (원형 pill 스타일)
- 로딩 중일 때 스피너 + "다른 책을 찾고 있습니다..."
- 횟수 제한 없음 (풀 고갈 시 라이브 생성으로 폴백)

---

## 7. 위험 및 대응

| 위험 | 심각도 | 대응 |
|------|--------|------|
| 캐시 풀 고갈 (20권 소진) | 낮음 | 라이브 생성으로 자동 폴백 |
| Gemini 비용 증가 | 낮음 | Step 1-2 스킵으로 상쇄 |
| 캐시 미구축 상태 | 없음 | 기존 로직 그대로 작동 |
| 국립도서관 API 장애 | 중간 | 캐시 있으면 영향 없음 |
| 중복 추천 | 없음 | ISBN 기반 제외 로직 |

---

## 8. 배포 절차

1. 코드 배포 (캐시 없어도 기존 로직으로 정상 동작)
2. `npm run build-cache` 실행 (20개 주제 × 약 30초 = ~10분)
3. Firestore에서 `theme_books` 컬렉션 생성 확인
4. 사이트에서 속도 개선 확인

---

## 9. 향후 개선 가능

- 캐시 구축을 Cloud Functions cron으로 자동화
- 주제 확대 시 (2번 요청사항) 동일 구조 재활용
- 사용자 피드백 기반으로 추천 품질 가중치 반영
