# ECC (Everything Claude Code) 적용 가이드

> 대상 프로젝트: 철학 도서 큐레이션 (book-curation)
> 작성일: 2026-04-09

---

## 1단계: 토큰 최적화 설정

`C:\Users\USER\.claude\settings.json` 파일을 다음과 같이 수정:

```json
{
  "autoUpdatesChannel": "latest",
  "model": "opus",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50"
  }
}
```

- `model`은 `opus` 유지 (설계/검증 작업 위주이므로)
- 단순 작업 시 `/model sonnet`으로 전환, 복잡한 작업 시 `/model opus`로 복귀
- `/cost`로 세션 중 토큰 지출 모니터링 가능

---

## 2단계: AgentShield 보안 스캔

터미널에서 프로젝트 루트(`c:\workspace\book-curation`)로 이동 후:

```bash
npx ecc-agentshield scan
```

문제가 발견되면 안전한 자동 수정:

```bash
npx ecc-agentshield scan --fix
```

### 스캔 대상
- CLAUDE.md, settings.json
- MCP 설정, 훅
- 시크릿 감지 (API 키 노출 여부)
- 권한 감사

### 주의
- `.env.local`은 `.gitignore`에 포함되어 있으므로 문제 없음
- 스캔 결과에서 critical/high 항목이 있으면 다음 세션에서 Claude에게 공유

---

## 3단계: ECC 플러그인 설치

### 방법 A: Claude Code에서 직접 설치 (권장)

Claude Code 대화창에서:

```
/plugin marketplace add https://github.com/affaan-m/everything-claude-code
/plugin install ecc@ecc
```

### 방법 B: settings.json에 직접 추가

`C:\Users\USER\.claude\settings.json`:

```json
{
  "autoUpdatesChannel": "latest",
  "model": "opus",
  "env": {
    "MAX_THINKING_TOKENS": "10000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "50"
  },
  "extraKnownMarketplaces": {
    "ecc": {
      "source": {
        "source": "github",
        "repo": "affaan-m/everything-claude-code"
      }
    }
  },
  "enabledPlugins": {
    "ecc@ecc": true
  }
}
```

### 설치 확인

Claude Code에서:

```
/plugin list ecc@ecc
```

사용 가능한 에이전트, 커맨드, 스킬 목록이 표시되면 성공.

---

## 4단계: Rules 설치 (common + typescript)

플러그인은 rules를 자동 배포하지 않으므로 수동 설치 필요.

### 4-1. 저장소 클론

```bash
cd c:\workspace
git clone https://github.com/affaan-m/everything-claude-code.git
```

### 4-2. Rules 복사

```bash
# 사용자 레벨 (모든 프로젝트에 적용)
mkdir -p ~/.claude/rules
cp -r everything-claude-code/rules/common/* ~/.claude/rules/
cp -r everything-claude-code/rules/typescript/* ~/.claude/rules/
```

또는 프로젝트 레벨로 (이 프로젝트에만 적용):

```bash
mkdir -p c:\workspace\book-curation\.claude\rules
cp -r everything-claude-code/rules/common/* c:\workspace\book-curation/.claude/rules/
cp -r everything-claude-code/rules/typescript/* c:\workspace\book-curation/.claude/rules/
```

### 4-3. (선택) 클론한 저장소 정리

```bash
rm -rf c:\workspace\everything-claude-code
```

---

## 설치 후 활용법

### 자주 쓸 커맨드

| 커맨드 | 용도 | 우리 프로젝트 활용 |
|---|---|---|
| `/ecc:plan "기능명"` | 구현 계획 | 안티에게 전달할 명세 작성 |
| `/ecc:code-review` | 코드 리뷰 | 안티 작업물 검증 |
| `/ecc:build-fix` | 빌드 에러 수정 | Vercel 배포 에러 대응 |
| `/ecc:security-scan` | 보안 스캔 | API 키/설정 점검 |
| `/model sonnet` | 모델 전환 | 단순 작업 시 비용 절감 |
| `/model opus` | 모델 전환 | 설계/검증 시 |
| `/cost` | 비용 확인 | 토큰 사용량 모니터링 |
| `/compact` | 컨텍스트 압축 | 작업 전환 시점에 |
| `/clear` | 컨텍스트 초기화 | 새 작업 시작 시 |

---

## 체크리스트

- [ ] 1단계: settings.json에 env 설정 추가
- [ ] 2단계: `npx ecc-agentshield scan` 실행
- [ ] 3단계: ECC 플러그인 설치
- [ ] 4단계: Rules (common + typescript) 복사
- [ ] 설치 확인: `/plugin list ecc@ecc`
