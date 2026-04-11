# Knowledge Link Hub

> 그룹이 링크·노트를 함께 모으고, 언제든 빠르게 찾는 **그룹 지식 창고**

---

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [주요 기능](#주요-기능)
- [설치 및 실행 방법](#설치-및-실행-방법)
- [환경 변수 설정](#환경-변수-설정)
- [폴더 구조](#폴더-구조)
- [배포 방법](#배포-방법)
- [운영 시 주의사항](#운영-시-주의사항)
- [처음 시작하는 분을 위한 가이드](#처음-시작하는-분을-위한-가이드)
- [English Documentation](#english-documentation)

---

## 프로젝트 개요

**Knowledge Link Hub**는 팀·스터디·커뮤니티 등 모든 종류의 그룹이 인터넷 카페나 오픈채팅방처럼 자유롭게 참여하고, 링크·메모를 함께 쌓아가는 그룹 지식 창고 서비스입니다.

- **기술 스택**: Next.js 15 (App Router) · TypeScript · Supabase (PostgreSQL + Auth + RLS) · Tailwind CSS
- **인증**: 아이디 + 4자리 PIN · Google · GitHub · Kakao OAuth
- **보안**: OWASP ASVS 기반 · RLS · SSRF 방어 · Rate Limiting · 입력값 검증
- **포트**: 개발 서버 `8001`
- **저작권**: SoDam AI Studio

---

## 주요 기능

### 인증
- 아이디 + 4자리 숫자 PIN 간편 가입/로그인
- Google, GitHub, Kakao 소셜 로그인
- PIN 보안: 서버 HMAC-SHA256 해싱, 취약 번호 차단, 로그인 시도 제한
- 안전한 세션 관리 (Supabase Auth + RLS)

### 그룹
- 그룹 생성 (공개 / 비공개)
- 초대 코드로 멤버 초대 (72시간 유효)
- 공개 그룹 탐색 페이지 (`/explore`)
- 카테고리 분류: AI / 개발 / 디자인 / 마케팅 / 학습 / 비즈니스 / 투자 / 기타
- 공개 그룹 최대 500명, 비공개 최대 20명
- 사용자 최대 10개 그룹 가입
- 그룹 설정: 이름·설명·카테고리 편집, 멤버 강퇴, 운영 권한 양도

### 콘텐츠
- 링크 저장 (URL 자동 제목·썸네일 추출, OG 메타 자동 수집)
- 노트 저장 (텍스트 메모)
- 태그 분류 (쉼표 구분, 최대 10개, 태그 필터링)
- 전체 / 링크 / 노트 필터 탭
- 전체 피드 (모든 소속 그룹 통합 보기)
- 검색: 1글자부터 가능 (자음·알파벳·URL 주소 검색 지원)
  - 2글자 이상: pg_trgm 유사도 검색 (제목·내용·URL·태그)
  - 1글자: 직접 ilike 매칭
- 카드 클릭 → 상세 시트 (전체 내용, 썸네일, 태그, 수정/삭제)
- 링크 제목 클릭 → 외부 URL 바로 연결
- 인라인 수정 (제목·내용·태그)
- 핀 고정 (피드 상단 고정)
- 소프트 삭제 (30일 내 복구 가능)
- 무한 스크롤 (IntersectionObserver)

### UI/UX
- 토스트 알림 시스템 (저장·수정·삭제·오류 실시간 피드백)
- 저장하기: 바닥 시트 (모바일 슬라이드 업, 데스크톱 모달)
- 클립보드 자동 감지 (URL 복사 후 저장 시 자동 입력)
- OG 메타 미리보기 (URL 입력 시 제목·썸네일 자동 표시)
- 카드 상세 시트 (바닥 시트 패턴, 모바일/데스크톱 대응)
- 컴팩트 카드 레이아웃 (2행 고정, 태그 최대 2개 + 초과 표시)

### 보안
- Row Level Security (RLS) 전면 적용
- SECURITY DEFINER 패턴으로 RLS 재귀 방지
- SSRF 방어: 사설 IP/루프백/클라우드 메타데이터 차단 (HTTPS 전용)
- Rate Limiting: Upstash Redis 슬라이딩 윈도우 (로그인 5회/10분, 가입 3회/1시간, OG 20회/분)
- 입력값 Zod 검증 + HTML 이스케이프 처리
- 보안 헤더: X-Frame-Options, CSP, HSTS, X-Content-Type-Options
- PIN 취약 번호 차단 (0000, 1234 등)
- OG 프록시: 인증 필수, 512KB 응답 제한, 3초 타임아웃

---

## 설치 및 실행 방법

### 준비물
- Node.js 18 이상 (권장: 20 LTS)
- npm 또는 yarn
- Supabase 계정 및 프로젝트

### 1단계 — 소스코드 가져오기

```bash
git clone https://github.com/sodam-ai/knowledge-link-hub.git
cd knowledge-link-hub
```

### 2단계 — 패키지 설치

```bash
npm install
```

### 3단계 — 환경 변수 설정

```bash
cp .env.example .env.local
# .env.local 파일을 열어 값을 채워넣습니다 (아래 환경 변수 섹션 참고)
```

### 4단계 — Supabase 마이그레이션 실행

Supabase CLI를 사용하거나 대시보드 SQL Editor에서 `supabase/migrations/` 폴더의 파일을 번호 순서대로 실행합니다:

```
001_initial_schema.sql
002_search_rpc.sql
003_user_profile_trigger.sql
004_fix_rls_recursion.sql
005_groups_upgrade.sql
006_username_auth.sql
007_public_only.sql
008_search_rpc_url.sql
```

```bash
# Supabase CLI 사용 시
npx supabase db push
```

### 5단계 — 개발 서버 시작

```bash
npm run dev -- --port 8001
```

브라우저에서 `http://localhost:8001` 접속

---

## 환경 변수 설정

`.env.local` 파일에 아래 값을 설정합니다.

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # 서버 전용, 절대 클라이언트에 노출 금지

# PIN 인증 내부 시크릿 (필수)
AUTH_INTERNAL_SECRET=  # openssl rand -hex 32 으로 생성

# Upstash Redis — Rate Limiting (권장)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...

# Microlink.io — URL 제목 자동 추출 (선택, 없으면 URL을 제목으로 사용)
MICROLINK_API_KEY=

# Naver OAuth (선택)
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_CALLBACK_URL=http://localhost:8001/api/auth/naver/callback

# Sentry (선택)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

> **중요**: `.env.local`은 절대 git에 커밋하지 마세요. `.gitignore`에 이미 포함되어 있습니다.

---

## 폴더 구조

```
knowledge-link-hub/
├── src/
│   ├── actions/              # 서버 액션 (auth, items, teams)
│   ├── app/
│   │   ├── (auth)/           # 로그인, 회원가입 페이지
│   │   ├── (dashboard)/      # 대시보드, 온보딩, 설정
│   │   ├── api/              # Naver OAuth + OG 메타 추출 API
│   │   ├── auth/             # OAuth 콜백
│   │   ├── explore/          # 공개 그룹 탐색 페이지
│   │   ├── group-settings/   # 그룹 설정·멤버 관리
│   │   ├── join/             # 초대 코드 참여 페이지
│   │   └── share/            # 링크 공유 페이지
│   ├── components/
│   │   ├── items/            # ItemCard, ItemFeed, SaveItemButton, SearchBar
│   │   ├── layout/           # TeamHeader
│   │   └── ui/               # Toast 시스템
│   ├── lib/
│   │   ├── supabase/         # Supabase 클라이언트 (server, client, middleware)
│   │   ├── security/         # Rate Limiter, PIN 취약번호 차단
│   │   ├── validations/      # Zod 스키마
│   │   └── utils.ts          # 유틸리티 (sanitize, formatDate 등)
│   ├── middleware.ts          # 인증 미들웨어
│   └── types/                # TypeScript 타입 정의
├── supabase/
│   └── migrations/           # SQL 마이그레이션 파일 (001~008)
├── .env.example              # 환경 변수 예시 (실제 값 없음)
├── .gitignore
├── LICENSE                   # MIT License (SoDam AI Studio)
└── package.json
```

---

## 배포 방법

### Vercel 배포 (권장)

1. [vercel.com](https://vercel.com)에서 프로젝트 Import
2. 환경 변수를 Vercel Dashboard > Settings > Environment Variables에 입력
3. 콜백 URL을 실제 도메인으로 업데이트
4. Supabase Dashboard > Authentication > URL Configuration에서 리다이렉트 URL 추가:
   - `https://yourdomain.vercel.app/auth/callback`
   - `https://yourdomain.vercel.app/api/auth/naver/callback`

```bash
# Vercel CLI 사용 시
npm i -g vercel
vercel --prod
```

---

## 운영 시 주의사항

1. **`SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용** — 클라이언트 코드에 포함하면 DB 전체가 노출됩니다.
2. **`AUTH_INTERNAL_SECRET`은 반드시 설정** — PIN 인증에 필수입니다. `openssl rand -hex 32`로 생성하세요.
3. **마이그레이션 순서 준수** — SQL 파일 번호(001~008) 순서대로 실행해야 합니다.
4. **Rate Limiting** — Upstash Redis 미설정 시 fail-open(제한 없음)으로 동작합니다. 운영 환경에서는 반드시 설정하세요.
5. **소프트 삭제** — 삭제된 항목은 30일 후 자동 정리되도록 Supabase pg_cron 설정 필요.
6. **OG 메타 추출** — `/api/og` 엔드포인트는 인증된 사용자만 호출 가능하며, SSRF 방어가 적용되어 있습니다.
7. **보안 헤더** — `next.config.ts`에 CSP, HSTS 등 보안 헤더가 설정되어 있습니다. 외부 리소스 추가 시 CSP 정책 업데이트 필요.

---

## 처음 시작하는 분을 위한 가이드

> 코딩을 한 번도 해본 적 없어도 괜찮습니다! 아래 순서대로 따라하면 됩니다.

### 필요한 것
- 컴퓨터 (Windows / Mac)
- 인터넷 연결
- [Node.js](https://nodejs.org) 설치 (LTS 버전 권장)
- [Supabase](https://supabase.com) 무료 계정

### 단계별 안내

**1. Node.js 설치**
- [nodejs.org](https://nodejs.org)에서 "LTS" 버전 다운로드 후 설치
- 설치 완료 후 터미널(명령 프롬프트)을 열고 `node --version` 입력 → 버전 숫자가 나오면 성공

**2. 소스코드 다운로드**
- 이 페이지 상단 녹색 `Code` 버튼 > `Download ZIP` 클릭
- 압축 해제 후 폴더 이름을 기억해두세요

**3. 터미널에서 폴더 열기**
- Windows: 폴더 안에서 Shift+우클릭 > "PowerShell 창 열기" 또는 "터미널에서 열기"
- Mac: Finder에서 폴더 우클릭 > "서비스" > "폴더에서 새 터미널 열기"

**4. 설치 명령어 실행**
```
npm install
```
(인터넷 속도에 따라 1~3분 소요)

**5. Supabase 설정**
- [supabase.com](https://supabase.com) 회원가입 > 새 프로젝트 생성
- Project Settings > API에서 URL과 anon key 복사
- `.env.example` 파일을 `.env.local`로 복사하고, 복사한 값 붙여넣기
- `AUTH_INTERNAL_SECRET`은 아무 긴 문자열 입력 (예: 키보드 무작위 30자 이상)

**6. 데이터베이스 준비**
- Supabase 대시보드 > SQL Editor 접속
- `supabase/migrations/` 폴더에 있는 파일을 001번부터 008번까지 순서대로 복사-붙여넣기 후 실행

**7. 실행**
```
npm run dev -- --port 8001
```
브라우저에서 `http://localhost:8001` 접속!

### 자주 묻는 질문

**Q. "npm: command not found" 오류가 나요**  
A. Node.js가 설치되지 않았습니다. [nodejs.org](https://nodejs.org)에서 LTS 버전을 설치하세요.

**Q. "EADDRINUSE" 오류가 나요**  
A. 이미 같은 포트를 사용하는 프로그램이 있습니다. `npx kill-port 8001` 실행 후 다시 시도하세요.

**Q. 가입이 안 돼요**  
A. `.env.local` 파일에 Supabase URL과 키가 올바르게 입력되었는지 확인하세요.

---

## English Documentation

### Overview

**Knowledge Link Hub** is a group knowledge vault where teams, study groups, and communities can save links and notes together — like an internet cafe or group chat, but purpose-built for knowledge sharing.

- **Stack**: Next.js 15 (App Router) · TypeScript · Supabase (PostgreSQL + Auth + RLS) · Tailwind CSS
- **Auth**: Username + 4-digit PIN · Google · GitHub · Kakao OAuth
- **Security**: OWASP ASVS · RLS · SSRF protection · Rate Limiting · Input validation
- **Copyright**: SoDam AI Studio

### Key Features

- **Groups**: Create/join public or private groups, invite by code, explore public groups
- **Content**: Save links (auto OG meta extraction) and notes with tags
- **Search**: Works from 1 character — supports Korean consonants, alphabets, and URL search (pg_trgm + ilike)
- **Detail View**: Bottom sheet with full content, thumbnail, tags, edit/delete
- **Link Navigation**: Click title to open URL directly, click card for detail view
- **Toast Notifications**: Real-time feedback for save, edit, delete, error
- **Bottom Sheet Save**: Mobile slide-up, desktop modal, clipboard auto-detect
- **Infinite Scroll**: IntersectionObserver-based auto-loading
- **Security**: RLS, SSRF defense, rate limiting, Zod validation, security headers

### Quick Start

```bash
git clone https://github.com/sodam-ai/knowledge-link-hub.git
cd knowledge-link-hub
npm install
cp .env.example .env.local   # Fill in your credentials
npx supabase db push          # Apply migrations (001-008)
npm run dev -- --port 8001
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only, never expose) |
| `AUTH_INTERNAL_SECRET` | Yes | HMAC secret for PIN auth (`openssl rand -hex 32`) |
| `UPSTASH_REDIS_REST_URL` | Recommended | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Upstash Redis token |
| `MICROLINK_API_KEY` | Optional | Microlink API for URL title extraction |
| `NAVER_CLIENT_ID` | Optional | Naver OAuth client ID |
| `NAVER_CLIENT_SECRET` | Optional | Naver OAuth client secret |

### Deployment

Deploy to Vercel:
1. Import repository at [vercel.com](https://vercel.com)
2. Add environment variables in Vercel Dashboard
3. Update redirect URLs in Supabase Authentication settings
4. Apply all migrations (001-008) to your Supabase project

### Security

- All data access protected by Supabase Row Level Security (RLS)
- SSRF defense: blocks private IPs, loopback, cloud metadata endpoints (HTTPS-only)
- Rate limiting: login (5/10min), signup (3/hour), OG extraction (20/min per user)
- All inputs validated with Zod + HTML sanitization
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- PIN auth: HMAC-SHA256 hashing, weak PIN blocklist, attempt limiting

---

## License

MIT License — Copyright (c) 2026 SoDam AI Studio

See [LICENSE](./LICENSE) for details.
