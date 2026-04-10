# 수정 지시서: 주제 다양성 구현 점검 결과 패치

> 원본 스펙: `docs/SPEC_TOPIC_DIVERSITY.md`
> 점검 기준: 2026-04-10 구현 결과물
> 대상 파일 6개, 수정 항목 9건 (CRITICAL 3 / HIGH 3 / MEDIUM 3)

---

## CRITICAL-1: 그룹별 생성 수 하드코딩 → targetCount 사용

**파일**: `scripts/seed-themes-expanded.ts`
**위치**: line 93

### 현재 (버그)
```typescript
const themes = await generateThemesForGroup(group.name, 20, group.types, existingThemes);
```

### 수정
```typescript
const themes = await generateThemesForGroup(group.name, group.targetCount, group.types, existingThemes);
```

### 주의사항
- Gemini 한 번 호출로 80개를 안정적으로 생성하기 어려울 수 있음
- 40개 초과 시 2회에 나눠 호출하는 로직 권장:

```typescript
async function generateThemesForGroup(groupName: string, targetCount: number, types: string[], existingThemes: any[]) {
  const batchSize = 40 // Gemini가 안정적으로 생성 가능한 단위
  let allThemes: any[] = []

  for (let generated = 0; generated < targetCount; generated += batchSize) {
    const remaining = Math.min(batchSize, targetCount - generated)
    // existingThemes + 이미 생성된 것도 중복 방지 목록에 포함
    const excludeList = [...existingThemes, ...allThemes]
    const themes = await callGemini(groupName, remaining, types, excludeList)
    allThemes = [...allThemes, ...themes]

    // Gemini API 쓰로틀링 방지
    if (generated + batchSize < targetCount) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  return allThemes
}
```

---

## CRITICAL-2: Firestore batch 500건 제한 처리

**파일**: `scripts/seed-themes-expanded.ts`
**위치**: line 111~127

### 현재 (잠재 오류)
```typescript
const batch = db.batch();
for (const theme of allNewThemes) {
  const ref = db.collection("themes").doc(theme.themeId);
  batch.set(ref, { ... });
}
await batch.commit(); // 500건 초과 시 실패
```

### 수정
```typescript
const BATCH_LIMIT = 499 // Firestore batch 최대 500 ops

for (let i = 0; i < allNewThemes.length; i += BATCH_LIMIT) {
  const batch = db.batch()
  const chunk = allNewThemes.slice(i, i + BATCH_LIMIT)

  for (const theme of chunk) {
    const ref = db.collection("themes").doc(theme.themeId)
    batch.set(ref, {
      ...theme,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  await batch.commit()
  console.log(`Committed batch ${Math.floor(i / BATCH_LIMIT) + 1}: ${chunk.length} themes`)
}
```

---

## CRITICAL-3: seeded shuffle dead code 정리

**파일**: `app/api/themes/route.ts`
**위치**: line 32~56 (`shuffleArray` 함수)

### 현재 (dead code + 편향된 분포)
```typescript
function shuffleArray(array: any[], seed?: string | null) {
  const arr = [...array]
  if (seed) {
    let seedNum = 0
    for (let i = 0; i < seed.length; i++) {
      seedNum += seed.charCodeAt(i)
    }
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(((seedNum * (i + 1)) % 1) * (i + 1)) // dead code (항상 0)
      const k = (seedNum + i) % (i + 1);                          // 편향된 분포
      [arr[i], arr[k]] = [arr[k], arr[i]]
    }
  } else { ... }
  return arr
}
```

### 수정: mulberry32 기반 seeded PRNG + Fisher-Yates
```typescript
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashSeed(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

function shuffleArray<T>(array: T[], seed?: string | null): T[] {
  const arr = [...array]
  const random = seed ? mulberry32(hashSeed(seed)) : Math.random

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}
```

---

## HIGH-1: `count` 파라미터 반영

**파일**: `app/api/themes/route.ts`
**위치**: line 63, 75~80

### 현재 (count 무시)
```typescript
const totalTargetCount = countParam ? parseInt(countParam) : 20 // 계산만 하고 미사용

const config = [
  { name: "생활형", target: 8 },      // 고정
  { name: "관심사형", target: 5 },
  { name: "사회·기술형", target: 4 },
  { name: "입문·출발형", target: 3 },
]
```

### 수정: count에 비례하여 그룹별 할당 조정

```typescript
const totalTargetCount = countParam ? parseInt(countParam) : 20

// 기본 비율: 8:5:4:3 = 20
const BASE_RATIOS = [
  { name: "생활형", ratio: 8 },
  { name: "관심사형", ratio: 5 },
  { name: "사회·기술형", ratio: 4 },
  { name: "입문·출발형", ratio: 3 },
]
const BASE_TOTAL = 20

const config = BASE_RATIOS.map(({ name, ratio }) => ({
  name,
  target: Math.max(1, Math.round((ratio / BASE_TOTAL) * totalTargetCount)),
}))
```

---

## HIGH-2: seed 사용 시 core 선택 수도 결정적으로

**파일**: `app/api/themes/route.ts`
**위치**: line 91

### 현재 (seed와 무관하게 Math.random 사용)
```typescript
const coreToPickCount = Math.min(coreThemes.length, Math.floor(Math.random() * 2) + 1)
```

### 수정: CRITICAL-3에서 도입한 PRNG 재사용

```typescript
// GET 함수 상단에서 random 함수 생성
const random = seed ? mulberry32(hashSeed(seed)) : Math.random

// ... config.forEach 내부에서
const coreToPickCount = Math.min(coreThemes.length, Math.floor(random() * 2) + 1)

// shuffleArray 호출도 seed 대신 같은 random 인스턴스를 쓰거나,
// 기존처럼 seed 문자열 전달 방식 유지 (CRITICAL-3 수정으로 이미 결정적)
```

**핵심**: 같은 seed → 같은 결과. `Math.random()` 호출을 제거하고 seeded PRNG로 통일.

---

## HIGH-3: themeId 중복 검사 추가

**파일**: `scripts/seed-themes-expanded.ts`
**위치**: main 함수, Firestore commit 직전

### 현재 (검사 없음)
Gemini가 기존 themeId와 동일한 값을 생성하면 `batch.set()`으로 기존 core 주제를 덮어씀.

### 수정: 2단계 검증

```typescript
// 1. 기존 themeId 집합 구성
const existingIds = new Set(existingThemes.map(t => t.themeId))

// 2. 생성된 주제에서 중복 제거 + 경고
const deduped = allNewThemes.filter(theme => {
  if (existingIds.has(theme.themeId)) {
    console.warn(`⚠️ 중복 themeId 제거: ${theme.themeId} (기존 주제와 충돌)`)
    return false
  }
  return true
})

// 3. 생성된 주제 내 자체 중복도 제거
const seen = new Set<string>()
const uniqueNewThemes = deduped.filter(theme => {
  if (seen.has(theme.themeId)) {
    console.warn(`⚠️ 내부 중복 themeId 제거: ${theme.themeId}`)
    return false
  }
  seen.add(theme.themeId)
  return true
})

// 이후 uniqueNewThemes를 JSON 저장 및 commit에 사용
```

---

## MEDIUM-1: "다른 주제 보기" 클릭 시 Skeleton 대신 부드러운 전환

**파일**: `app/page.tsx`

### 현재
`fetchThemes`가 `loading`을 true로 설정 → 전체 Skeleton UI 표시 → 깜빡임.

### 수정: refreshing 상태 분리

```typescript
const [loading, setLoading] = useState(true)          // 최초 로드용
const [refreshing, setRefreshing] = useState(false)    // 새로고침용

const fetchThemes = async (isRefresh = false) => {
  if (isRefresh) {
    setRefreshing(true)
  } else {
    setLoading(true)
  }
  try {
    const res = await fetch("/api/themes")
    const data = await res.json()
    setThemes(data)
  } catch (err) {
    console.error("Failed to fetch themes", err)
  } finally {
    setLoading(false)
    setRefreshing(false)
  }
}

useEffect(() => { fetchThemes(false) }, [])
```

버튼에서:
```tsx
<button
  onClick={() => fetchThemes(true)}
  disabled={refreshing}
>
  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : '...'}`} />
  다른 주제 보기
</button>
```

Skeleton 조건:
```tsx
{loading ? (
  <Skeleton ... />
) : ( ... )}
```

이렇게 하면 최초 로드만 Skeleton, 새로고침은 버튼 스피너만 표시.

추가로 주제 목록에 fade 효과를 원하면:
```tsx
<div className={`space-y-10 transition-opacity duration-300 ${refreshing ? 'opacity-50' : 'opacity-100'}`}>
```

---

## MEDIUM-2: priorityOrder 자동 할당

**파일**: `scripts/seed-themes-expanded.ts`

### 현재
Gemini 프롬프트에 `"priorityOrder": 100` 하드코딩 → 모든 확장 주제가 동일 값.

### 수정

Gemini 프롬프트에서 `priorityOrder` 필드를 제거하고, commit 시 자동 할당:

```typescript
// Gemini 프롬프트의 JSON 형식에서 priorityOrder 제거

// commit 시 그룹별 인덱스 부여 (기존 core 이후부터)
const groupCounters: Record<string, number> = {}

// 기존 주제 중 그룹별 최대 priorityOrder 파악
for (const theme of existingThemes) {
  const current = groupCounters[theme.group] ?? 0
  groupCounters[theme.group] = Math.max(current, theme.priorityOrder ?? 0)
}

for (const theme of uniqueNewThemes) {
  const nextOrder = (groupCounters[theme.group] ?? 0) + 1
  groupCounters[theme.group] = nextOrder
  theme.priorityOrder = nextOrder
}
```

---

## MEDIUM-3: extended 주제 온디맨드 캐시 자동 저장

**파일**: `app/api/recommend/route.ts`
**위치**: line 180~206 (STEP 4 블록)

### 현재
라이브 생성 후 `books` 컬렉션에만 저장. `theme_books`에는 저장하지 않음.

### 수정: 캐시 미스로 라이브 생성한 경우 `theme_books`에도 저장

STEP 4 블록(fire-and-forget 비동기) 안에 추가:

```typescript
// 기존 books 컬렉션 저장 코드 아래에 추가
// theme_books 캐시 자동 구축 (캐시 미스로 라이브 생성한 경우만)
if (!cacheDoc.exists || verifiedBooks.length > 0) {
  try {
    await db.collection("theme_books").doc(themeId).set({
      themeId: themeId,
      themeName: theme.name,
      verifiedBooks: verifiedBooks.map((b: any) => ({
        title: b.title,
        author: b.author,
        publisher: b.publisher,
        pubYear: b.pubYear,
        isbn: b.isbn,
        coverImage: b.coverImage,
        description: b.description,
      })),
      totalCount: verifiedBooks.length,
      cachedAt: FieldValue.serverTimestamp(),
    })
  } catch (e) {
    console.error("theme_books auto-cache error:", e)
  }
}
```

### 조건 정리
- 캐시 히트 시: 기존 동작 유지 (저장 불요)
- 캐시 미스 시: 라이브 생성 → `books` + `theme_books` 양쪽에 저장
- 이렇게 하면 extended 주제도 첫 사용자가 접속한 뒤 자동으로 캐시가 쌓임

---

## 수정 순서 (권장)

```
1. CRITICAL-3 → seeded shuffle 수정 (다른 수정의 기반)
2. HIGH-2    → seed + core 선택 결정적 통일 (CRITICAL-3 의존)
3. HIGH-1    → count 파라미터 반영
4. HIGH-3    → themeId 중복 검사
5. CRITICAL-1 → targetCount 사용
6. CRITICAL-2 → batch 500건 분할
7. MEDIUM-2  → priorityOrder 자동 할당
8. MEDIUM-1  → refreshing 상태 분리 + fade
9. MEDIUM-3  → 온디맨드 캐시 자동 저장
```

수정 후 검증:
- [ ] `npm run seed-themes-expanded` → `data/themes-candidates.json`에 200개 이상 생성 확인
- [ ] 동일 seed로 `/api/themes?seed=test` 2회 호출 → 결과 동일 확인
- [ ] `/api/themes?count=10` → 10개 반환 확인
- [ ] "다른 주제 보기" 클릭 → Skeleton 미표시, 버튼 스피너만 확인
- [ ] extended 주제 선택 → 추천 정상 + Firestore `theme_books`에 자동 캐시 확인
