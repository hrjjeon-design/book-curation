# 구현 명세서: 주제 다양성 확대 + 랜덤 표시

## 1. 개요

### 목적
- 현재 20개 고정 주제 → **200~300개**로 확대하여 재방문 시 새로운 경험 제공
- 화면에는 기존과 동일한 **20개**만 표시하되, 매 방문마다 **랜덤 선택**
- 그룹(생활형, 관심사형 등) 비율은 유지

### 현재 구조
| 항목 | 현재 |
|------|------|
| 주제 총 수 | 20개 (seed.ts 하드코딩) |
| 표시 방식 | 전체 표시, priorityOrder 순 고정 |
| 그룹 | 생활형(8), 관심사형(5), 사회·기술형(4), 입문·출발형(3) |
| 캐시 | 20개 주제 모두 사전 캐시 (theme_books) |

### 변경 범위
| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `scripts/seed-themes-expanded.ts` | 신규 | 300개 주제 시드 스크립트 |
| `app/api/themes/route.ts` | 수정 | 랜덤 샘플링 + 그룹 비율 유지 로직 |
| `app/page.tsx` | 수정 | "다른 주제 보기" 새로고침 버튼 추가 |
| `scripts/build-theme-cache.ts` | 수정 | 대량 주제 대응 (배치, 우선순위) |

---

## 2. 주제 확장 설계

### 2.1 그룹 구조 및 비율

현재 4개 그룹을 유지하되 하위 type을 활용하여 다양성 확보.

| 그룹 | 현재 | 확대 목표 | 화면 표시 수 | 설명 |
|------|------|-----------|-------------|------|
| 생활형 | 8개 | 80~100개 | 8개 | 감정·상황 기반 (불안, 이별, 번아웃 등) |
| 관심사형 | 5개 | 60~80개 | 5개 | 철학적 질문·개념 (자유의지, 시간, 언어 등) |
| 사회·기술형 | 4개 | 40~60개 | 4개 | 사회·정치·기술 이슈 (기후, 젠더, 미디어 등) |
| 입문·출발형 | 3개 | 20~40개 | 3개 | 입문 경로 (시대별, 동양철학, 분석철학 등) |
| **합계** | **20** | **200~280** | **20** | |

### 2.2 주제 데이터 구조 (변경 없음)

기존 Firestore `themes` 컬렉션 스키마를 그대로 사용:

```typescript
{
  themeId: string          // "burnout", "time_philosophy" 등
  name: string             // "번아웃이 왔을 때 읽는 철학"
  shortLabel: string       // "번아웃"
  group: string            // "생활형" | "관심사형" | "사회·기술형" | "입문·출발형"
  type: string             // "감정형" | "상황형" | "질문형" | "주제형" | "책/저자 출발형"
  description: string      // Gemini 프롬프트에 사용되는 설명
  relatedConcepts: string[] // 관련 개념 태그
  exampleQueries: string[] // 자유 검색 매칭용 예시 쿼리
  priorityOrder: number    // 그룹 내 정렬 순서
  isActive: boolean        // 활성 여부
  tier: "core" | "extended" // 신규: 핵심 vs 확장 주제 구분
}
```

### 2.3 `tier` 필드 추가

| 값 | 설명 | 개수 | 캐시 정책 |
|----|------|------|-----------|
| `core` | 기존 20개 + 핵심 주제 | ~50개 | 사전 캐시 (주 1회) |
| `extended` | 확장 주제 | ~230개 | 온디맨드 캐시 (첫 선택 시 구축) |

- `core` 주제는 반드시 랜덤 선택에 1~2개 포함 (최소 노출 보장)
- `extended` 주제는 캐시 없어도 기존 라이브 생성으로 정상 동작

---

## 3. 주제 생성 방법

### 3.1 시드 스크립트: `scripts/seed-themes-expanded.ts`

Gemini를 활용하여 그룹별 주제 후보를 생성한 뒤, 수동 검수 후 Firestore에 등록.

```
실행: npm run seed-themes-expanded
```

#### 동작 흐름
1. 그룹별 Gemini 프롬프트로 주제 후보 생성 (JSON 배열)
2. 기존 주제와 중복 검사 (themeId 및 name 유사도)
3. 결과를 `data/themes-candidates.json`에 저장 (검수용)
4. 검수 완료 후 `--commit` 플래그로 Firestore에 실제 등록

#### Gemini 프롬프트 예시 (생활형)
```
당신은 한국어 철학 도서 큐레이션 전문가입니다.

"생활형" 그룹에 속하는 철학 주제를 80개 생성하세요.
이 그룹은 일상의 감정이나 상황에서 출발하는 주제입니다.

기존 주제 (중복 금지):
- 불안할 때 읽는 철학
- 삶의 방향을 잃었을 때 읽는 철학
- ...

각 주제는 다음 형식으로:
{
  "themeId": "영문_snake_case",
  "name": "~할 때 읽는 철학" 또는 "~을/를 생각하게 하는 철학",
  "shortLabel": "2~4글자 키워드",
  "type": "감정형" | "상황형",
  "description": "이 주제에 해당하는 책의 특성을 한 문장으로",
  "relatedConcepts": ["관련 철학 개념 3~5개"],
  "exampleQueries": ["사용자가 검색할 만한 문장 2개"]
}
```

### 3.2 검수 기준

주제 품질 체크리스트:
- [ ] 한국어 철학 도서가 실제로 5권 이상 존재할 수 있는 주제인가?
- [ ] 기존 주제와 의미상 중복되지 않는가?
- [ ] `themeId`가 고유하고 영문 snake_case인가?
- [ ] `description`이 Gemini 추천 프롬프트에 활용 가능한가?
- [ ] `relatedConcepts`가 자유 검색 매칭에 도움이 되는가?

---

## 4. API 변경: `/api/themes`

### 현재
```typescript
// 모든 활성 주제를 priorityOrder 순으로 반환
db.collection("themes").where("isActive", "==", true).orderBy("priorityOrder").get()
```

### 변경 후
```typescript
GET /api/themes?count=20&seed={optional_seed}
```

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `count` | 20 | 반환할 주제 수 |
| `seed` | 없음 | 랜덤 시드 (같은 값이면 같은 결과, 디버깅용) |

### 샘플링 알고리즘

```
1. Firestore에서 모든 활성 주제를 가져온다 (캐시 가능)
2. 그룹별로 분류한다
3. 그룹별 할당 수를 계산한다:
   - 생활형: 8개
   - 관심사형: 5개
   - 사회·기술형: 4개
   - 입문·출발형: 3개
4. 각 그룹에서:
   a. core 주제 중 1~2개를 먼저 선택 (최소 노출 보장)
   b. 나머지는 전체(core + extended)에서 랜덤 선택
5. 그룹 내에서 랜덤 셔플 후 반환
```

### 서버 캐시 (선택)

Firestore 전체 조회를 매번 하지 않기 위해:
- 메모리 캐시: 5분 TTL로 전체 주제 목록 캐시
- 샘플링은 매 요청마다 새로 수행 (랜덤이므로)

---

## 5. 프론트엔드 변경

### 5.1 "다른 주제 보기" 버튼

주제 목록 하단에 버튼 추가:

```
[다른 주제 보기 ↻]
```

- 클릭 시 `/api/themes`를 다시 호출 (새로운 랜덤 세트)
- 현재 주제 목록을 교체
- 애니메이션: fade-out → fade-in (간단하게)

### 5.2 page.tsx 변경

```typescript
// 기존
useEffect(() => { fetch("/api/themes")... }, [])

// 변경: 새로고침 함수 분리
const fetchThemes = async () => {
  setLoading(true)
  const res = await fetch("/api/themes")
  const data = await res.json()
  setThemes(data)
  setLoading(false)
}

useEffect(() => { fetchThemes() }, [])
```

- `handleRefreshThemes` 함수 추가 → "다른 주제 보기" 버튼에 연결

---

## 6. 캐시 전략 변경

### 현재 (20개 주제)
```
npm run build-cache  →  20개 주제 모두 사전 캐시
```

### 변경 후 (200~300개 주제)

#### 사전 캐시: `core` 주제만 (~50개)
```bash
# core 주제만 캐시 (기본)
npm run build-cache

# 전체 캐시 (시간 여유 있을 때)
npm run build-cache -- --all
```

#### 온디맨드 캐시: `extended` 주제
- 사용자가 `extended` 주제를 선택하면 기존 라이브 생성 흐름 실행
- 라이브 생성 결과를 `theme_books`에 자동 저장 (다음 사용자부터 캐시 히트)
- 이미 `/api/recommend`에 캐시 미스 → 라이브 폴백 로직이 있으므로 **추가 구현 불요**

#### build-theme-cache.ts 변경
```typescript
// 기존: 모든 활성 주제
const snapshot = await db.collection("themes").where("isActive", "==", true).get()

// 변경: --all 플래그 없으면 core만
const allFlag = process.argv.includes("--all")
let query = db.collection("themes").where("isActive", "==", true)
if (!allFlag) {
  query = query.where("tier", "==", "core")
}
```

---

## 7. 마이그레이션

### 기존 20개 주제 처리
- 기존 20개 주제에 `tier: "core"` 필드 추가
- `themeId`, `name` 등 기존 필드는 변경 없음
- 기존 `theme_books` 캐시 데이터 유지

### 마이그레이션 스크립트
```bash
# 1단계: 기존 주제에 tier 필드 추가
npm run migrate-themes-tier

# 2단계: 확장 주제 후보 생성 (검수용 JSON 출력)
npm run seed-themes-expanded

# 3단계: 검수 후 Firestore 등록
npm run seed-themes-expanded -- --commit

# 4단계: core 주제 캐시 구축
npm run build-cache
```

---

## 8. 주제 후보 예시 (그룹별)

### 생활형 추가 예시
| themeId | name | type |
|---------|------|------|
| burnout | 번아웃이 왔을 때 읽는 철학 | 상황형 |
| anger | 화가 날 때 읽는 철학 | 감정형 |
| jealousy | 질투를 다스리고 싶을 때 읽는 철학 | 감정형 |
| breakup | 이별 후 읽는 철학 | 상황형 |
| career_change | 직업을 바꾸고 싶을 때 읽는 철학 | 상황형 |
| parenting | 부모가 되어 읽는 철학 | 상황형 |
| aging | 나이 듦을 생각하게 하는 철학 | 상황형 |
| failure | 실패 후에 읽는 철학 | 상황형 |
| boredom | 지루함을 생각하게 하는 철학 | 감정형 |
| gratitude | 감사에 대해 생각하게 하는 철학 | 감정형 |

### 관심사형 추가 예시
| themeId | name | type |
|---------|------|------|
| time_philosophy | 시간이란 무엇인지 묻는 철학 | 질문형 |
| language_philosophy | 언어와 사고를 생각하게 하는 철학 | 주제형 |
| beauty_aesthetics | 아름다움이란 무엇인지 묻는 철학 | 질문형 |
| truth | 진리란 무엇인지 묻는 철학 | 질문형 |
| identity | 나는 누구인지 묻는 철학 | 질문형 |
| memory | 기억과 망각을 생각하게 하는 철학 | 주제형 |
| evil | 악이란 무엇인지 묻는 철학 | 질문형 |
| dreams | 꿈과 현실을 생각하게 하는 철학 | 주제형 |

### 사회·기술형 추가 예시
| themeId | name | type |
|---------|------|------|
| climate_ethics | 기후 위기와 윤리를 생각하게 하는 철학 | 주제형 |
| gender_philosophy | 젠더와 정체성을 생각하게 하는 철학 | 주제형 |
| media_philosophy | 미디어와 진실을 생각하게 하는 철학 | 주제형 |
| capitalism | 자본주의를 다시 보게 하는 철학 | 주제형 |
| education_philosophy | 교육의 의미를 묻는 철학 | 주제형 |
| animal_ethics | 동물과 윤리를 생각하게 하는 철학 | 주제형 |

### 입문·출발형 추가 예시
| themeId | name | type |
|---------|------|------|
| eastern_philosophy | 동양 철학에서 시작하고 싶을 때 | 책/저자 출발형 |
| analytic_philosophy | 분석 철학에서 시작하고 싶을 때 | 책/저자 출발형 |
| existentialism_start | 실존주의에서 시작하고 싶을 때 | 책/저자 출발형 |
| stoicism_start | 스토아 철학에서 시작하고 싶을 때 | 책/저자 출발형 |
| philosophy_by_era | 시대별로 철학을 읽고 싶을 때 | 책/저자 출발형 |
| korean_philosophy | 한국 철학에서 시작하고 싶을 때 | 책/저자 출발형 |

---

## 9. 위험 및 대응

| 위험 | 심각도 | 대응 |
|------|--------|------|
| 확장 주제 품질 저하 (너무 마이너한 주제) | 중간 | 검수 단계에서 "도서 5권 이상 가능" 기준 필터 |
| Firestore 전체 조회 비용 | 낮음 | 5분 메모리 캐시로 조회 최소화 |
| 캐시 미구축 주제 선택 시 느린 응답 | 중간 | 기존 라이브 폴백 작동, 첫 사용 후 자동 캐시 |
| 300개 전체 캐시 구축 시간 | 중간 | core만 사전 캐시 (~50개, ~25분), 나머지 온디맨드 |
| 그룹별 주제 수 불균형 | 낮음 | 시드 시 그룹별 최소/최대 수 검증 |
| 자유 검색 매칭 성능 저하 (주제 300개) | 낮음 | route-query API에서 Gemini가 처리, 주제 수와 무관 |

---

## 10. 배포 절차

1. 기존 20개 주제에 `tier: "core"` 필드 추가 (마이그레이션 스크립트)
2. `seed-themes-expanded` 실행 → `data/themes-candidates.json` 검수
3. 검수 완료 후 `--commit`으로 Firestore 등록
4. `/api/themes` 랜덤 샘플링 로직 배포
5. 프론트엔드 "다른 주제 보기" 버튼 배포
6. `build-cache` 실행 (core 주제 캐시 구축)
7. 사이트에서 새로고침마다 주제 변경 확인

---

## 11. 향후 개선 가능

- 사용자 이력 기반 개인화 주제 추천 (자주 선택한 그룹 가중치 상향)
- 인기 주제/트렌드 주제 상단 고정
- 계절/시기별 주제 가중치 (연말 → "한 해를 돌아보며 읽는 철학")
- 사용자가 직접 주제 제안하는 기능
