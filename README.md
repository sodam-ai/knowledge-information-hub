# Knowledge Link Hub

> 비밀번호 하나로 누구나 접근하는 **공개형 링크·노트 지식 창고**

---

## 목차

- [프로젝트 개요](#프로젝트-개요)
- [주요 기능](#주요-기능)
- [설치 및 실행 방법](#설치-및-실행-방법)
- [환경 변수 설정](#환경-변수-설정)
- [Supabase 마이그레이션](#supabase-마이그레이션)
- [폴더 구조](#폴더-구조)
- [배포 방법](#배포-방법)
- [운영 시 주의사항](#운영-시-주의사항)
- [처음 시작하는 분을 위한 가이드](#처음-시작하는-분을-위한-가이드)
- [English Documentation](#english-documentation)

---

## 프로젝트 개요

**Knowledge Link Hub**는 팀·스터디·커뮤니티 등 모든 종류의 그룹이 링크와 노트를 함께 쌓고, 언제든 빠르게 찾을 수 있는 공개형 지식 창고 서비스입니다.

회원가입 없이 **열람 비밀번호(숫자 4자리)** 하나만 알면 누구나 접근할 수 있는 단순한 구조입니다.

- **기술 스택**: Next.js 15 (App Router) · TypeScript · Supabase (PostgreSQL) · Tailwind CSS
- **인증**: 사이트 전체 열람 비밀번호(숫자 4자리) · Web Crypto API HMAC-SHA256 세션
- **보안**: SSRF 방어 · Rate Limiting · 입력값 검증 · HttpOnly 세션 쿠키
- **관리**: `/admin` 페이지에서 열람·관리자 비밀번호 변경
- **저작권**: SoDam AI Studio

---

## 주요 기능

### 접근 방식
- 회원가입 없음 — 열람 비밀번호(숫자 4자리)만 입력하면 즉시 접근
- 세션 7일 유지 (HMAC-SHA256 서명 쿠키, HttpOnly)
- `/admin` 페이지에서 열람 비밀번호 · 관리자 비밀번호 변경 가능

### 그룹
- 그룹 생성 (공개 / 비공개)
- 공개 그룹 탐색 페이지 (`/explore`)
- 카테고리 분류: AI / 개발 / 디자인 / 마케팅 / 학습 / 비즈니스 / 투자 / 기타

### 콘텐츠
- 링크 저장 (URL 자동 제목·썸네일 추출, OG 메타 자동 수집)
- 노트 저장 (텍스트 메모)
- 태그 분류 (쉼표 구분, 최대 10개, 태그 필터링)
- 전체 / 링크 / 노트 필터 탭
- 전체 피드 (모든 그룹 통합 보기)
- 검색: 1글자부터 가능 (자음·알파벳·URL 주소 검색 지원)
  - 2글자 이상: pg_trgm 유사도 검색 (제목·내용·URL·태그)
  - 1글자: 직접 ilike 매칭
- 카드 클릭 → 상세 시트 (전체 내용, 썸네일, 태그, 수정/삭제)
- 링크 제목 클릭 → 외부 URL 바로 연결
- 인라인 수정 (제목·내용·태그)
- 핀 고정 (피드 상단 고정 섹션)
- 날짜별 그룹 헤더 (오늘 / 어제 / 이번 주 / 이번 달 / 그 이전)
- 소프트 삭제 (30일 내 복구 가능)
- 무한 스크롤 (IntersectionObserver)
- 새 그룹 온보딩 (`/onboarding` — 이름·설명·카테고리 입력 후 즉시 이동)

### UI/UX
- 토스트 알림 시스템 (저장·수정·삭제·오류 실시간 피드백)
- 저장하기: 바닥 시트 (모바일 슬라이드 업, 데스크톱 모달)
- 클립보드 자동 감지 (URL 복사 후 저장 시 자동 입력)
- OG 메타 미리보기 (URL 입력 시 제목·썸네일 자동 표시)
- 카드 상세 시트 (바닥 시트 패턴, 모바일/데스크톱 대응)
- 컴팩트 카드 레이아웃 (2행 고정, 태그 최대 2개 + 초과 표시)

### 보안
- SSRF 방어: 사설 IP/루프백/클라우드 메타데이터 차단 (HTTPS 전용)
- Rate Limiting: Upstash Redis 슬라이딩 윈도우 (OG 20회/분)
- 입력값 Zod 검증 + HTML 이스케이프 처리
- 보안 헤더: X-Frame-Options, CSP, HSTS, X-Content-Type-Options
- 세션 쿠키: HttpOnly · SameSite=Strict · Secure(프로덕션)

---

## 설치 및 실행 방법

### 준비물
- Node.js 18 이상 (권장: 20 LTS)
- npm
- Supabase 계정 및 프로젝트
- Upstash Redis 계정 (Rate Limiting용, 무료 티어로 충분)

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

Supabase Dashboard SQL Editor에서 `supabase/migrations/` 폴더의 파일을 번호 순서대로 실행합니다.

### 5단계 — 개발 서버 시작

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 후 열람 비밀번호(기본: `1234`) 입력

---

## 환경 변수 설정

`.env.local` 파일에 아래 값을 설정합니다.

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...   # 서버 전용, 절대 클라이언트에 노출 금지

# 사이트 URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 열람 비밀번호 — 숫자 4자리 (초기값, /admin 페이지에서 변경 가능)
VIEW_PASSWORD=1234

# 관리자 비밀번호 — /admin 페이지 접근 및 열람 비밀번호 변경에 사용 (/admin에서 변경 가능)
ADMIN_PASSWORD=your-admin-password

# 세션 서명 시크릿 — 절대 외부 노출 금지, 변경 시 모든 세션 무효화
# 생성: openssl rand -hex 32
SESSION_SECRET=your-random-64-hex-chars

# Upstash Redis — Rate Limiting (권장, 없으면 fail-open)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...

# Microlink.io — URL 제목 자동 추출 (선택, 없으면 URL을 제목으로 사용)
MICROLINK_API_KEY=
```

> **중요**: `.env.local`은 절대 git에 커밋하지 마세요. `.gitignore`에 이미 포함되어 있습니다.

---

## Supabase 마이그레이션

Supabase Dashboard > SQL Editor에서 아래 파일을 **번호 순서대로** 실행합니다:

```
supabase/migrations/
├── 001_initial_schema.sql      # 기본 테이블 구조
├── 002_search_rpc.sql          # 검색 RPC 함수
├── 003_user_profile_trigger.sql
├── 004_fix_rls_recursion.sql
├── 005_groups_upgrade.sql
├── 006_username_auth.sql
├── 007_public_only.sql
├── 008_search_rpc_url.sql
└── 009_site_config.sql         # 비밀번호 해시 저장 테이블 (필수)
```

> **009번은 반드시 실행해야 합니다.** 열람·관리자 비밀번호 변경 기능에 필요합니다.

---

## 폴더 구조

```
knowledge-link-hub/
├── src/
│   ├── actions/
│   │   ├── site-auth.ts      # 로그인·비밀번호 변경 서버 액션
│   │   ├── items.ts          # 콘텐츠 CRUD 서버 액션
│   │   └── teams.ts          # 그룹 서버 액션
│   ├── app/
│   │   ├── (auth)/login/     # 열람 비밀번호 입력 페이지
│   │   ├── (dashboard)/      # 대시보드 (피드, 그룹 전환)
│   │   ├── admin/            # 관리자 설정 페이지 (비밀번호 변경)
│   │   ├── api/og/           # OG 메타 추출 API
│   │   ├── explore/          # 공개 그룹 탐색 페이지
│   │   ├── onboarding/       # 새 그룹 만들기 온보딩 페이지
│   │   └── share/            # 링크 공유 페이지
│   ├── components/
│   │   ├── items/            # ItemCard, ItemFeed, SaveItemButton, SearchBar
│   │   ├── layout/           # TeamHeader (그룹 전환 + 관리자 링크)
│   │   └── ui/               # Toast 시스템
│   ├── lib/
│   │   ├── auth/session.ts   # Web Crypto API 세션 관리
│   │   ├── supabase/         # Supabase 클라이언트 (server, client)
│   │   ├── security/         # Rate Limiter
│   │   ├── validations/      # Zod 스키마
│   │   └── utils.ts          # 유틸리티
│   ├── middleware.ts          # 세션 쿠키 검증 미들웨어
│   └── types/                # TypeScript 타입 정의
├── supabase/
│   └── migrations/           # SQL 마이그레이션 파일 (001~009)
├── .env.example              # 환경 변수 예시 (실제 값 없음)
├── .gitignore
├── LICENSE                   # MIT License (SoDam AI Studio)
└── package.json
```

---

## 배포 방법

### Vercel 배포 (권장)

1. [vercel.com](https://vercel.com)에서 저장소 Import
2. Environment Variables에 `.env.local`의 모든 값 입력
   - `SESSION_SECRET`은 `openssl rand -hex 32`로 새로 생성하세요
   - `VIEW_PASSWORD`와 `ADMIN_PASSWORD`는 배포 전 반드시 변경하세요
3. Supabase Dashboard SQL Editor에서 마이그레이션 001~009 실행
4. 배포 후 `/admin` 페이지에서 비밀번호 재설정 권장

```bash
# Vercel CLI 사용 시
npm i -g vercel
vercel --prod
```

---

## 운영 시 주의사항

1. **`SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용** — 클라이언트 코드에 포함하면 DB 전체가 노출됩니다.
2. **`SESSION_SECRET` 절대 노출 금지** — 변경 시 모든 로그인 세션이 무효화됩니다. `openssl rand -hex 32`로 생성하세요.
3. **초기 비밀번호 반드시 변경** — 배포 후 `/admin` 페이지에서 `VIEW_PASSWORD`와 `ADMIN_PASSWORD`를 변경하세요.
4. **마이그레이션 순서 준수** — SQL 파일 번호(001~009) 순서대로 실행해야 합니다.
5. **009번 마이그레이션 필수** — 비밀번호 변경 기능이 `site_config` 테이블을 사용합니다.
6. **Rate Limiting** — Upstash Redis 미설정 시 fail-open(제한 없음)으로 동작합니다. 운영 환경에서는 반드시 설정하세요.
7. **소프트 삭제** — 삭제된 항목은 30일 후 자동 정리되도록 Supabase pg_cron 설정 필요.
8. **OG 메타 추출** — `/api/og` 엔드포인트는 세션 인증 후 접근 가능하며, SSRF 방어가 적용되어 있습니다.

---

## 처음 시작하는 분을 위한 가이드

> 코딩을 한 번도 해본 적 없어도 괜찮습니다! 아래 순서대로 따라하면 됩니다.

### 필요한 것
- 컴퓨터 (Windows / Mac)
- 인터넷 연결
- [Node.js](https://nodejs.org) 설치 (LTS 버전 권장)
- [Supabase](https://supabase.com) 무료 계정
- [Upstash](https://upstash.com) 무료 계정 (Redis, 선택이지만 권장)

### 단계별 안내

**1. Node.js 설치**
- [nodejs.org](https://nodejs.org)에서 "LTS" 버전 다운로드 후 설치
- 설치 완료 후 터미널에서 `node --version` 입력 → 버전 숫자가 나오면 성공

**2. 소스코드 다운로드**
- 이 페이지 상단 녹색 `Code` 버튼 > `Download ZIP` 클릭 후 압축 해제
- 또는 `git clone https://github.com/sodam-ai/knowledge-link-hub.git`

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
- Project Settings > API에서 `Project URL`과 `anon public` 키 복사
- `.env.example` 파일을 `.env.local`로 복사하고 복사한 값 붙여넣기
- `SERVICE_ROLE_KEY`도 같은 페이지 `service_role` 항목에서 복사
- `SESSION_SECRET`은 아무 긴 문자열 입력 (예: 키보드 무작위 64자 이상)

**6. 데이터베이스 준비**
- Supabase 대시보드 > SQL Editor 접속
- `supabase/migrations/` 폴더에 있는 파일을 001번부터 009번까지 순서대로 복사-붙여넣기 후 실행

**7. 실행**
```
npm run dev
```
브라우저에서 `http://localhost:3000` 접속!  
열람 비밀번호(기본: `1234`) 입력 후 사용 시작

**8. 비밀번호 변경 (중요!)**
- `/admin` 페이지 접속 (관리자 비밀번호 초기값: `12341234`)
- 열람 비밀번호와 관리자 비밀번호 변경 후 사용하세요

### 자주 묻는 질문

**Q. "npm: command not found" 오류가 나요**  
A. Node.js가 설치되지 않았습니다. [nodejs.org](https://nodejs.org)에서 LTS 버전을 설치하세요.

**Q. "EADDRINUSE" 오류가 나요**  
A. 이미 같은 포트를 사용하는 프로그램이 있습니다. `npx kill-port 3000` 실행 후 다시 시도하세요.

**Q. 비밀번호를 잊어버렸어요**  
A. `.env.local`의 `VIEW_PASSWORD` 또는 `ADMIN_PASSWORD` 값을 확인하세요. 배포 환경이라면 Vercel > Environment Variables에서 확인하세요.

---

## English Documentation

### Overview

**Knowledge Link Hub** is an open-access group knowledge vault where teams, study groups, and communities can save links and notes together.

No registration required — anyone with the **4-digit view password** can access instantly.

- **Stack**: Next.js 15 (App Router) · TypeScript · Supabase (PostgreSQL) · Tailwind CSS
- **Auth**: Single site-wide view password (4-digit numeric) · Web Crypto API HMAC-SHA256 sessions
- **Admin**: Change view/admin passwords at `/admin`
- **Security**: SSRF defense · Rate limiting · Input validation · HttpOnly session cookie
- **Copyright**: SoDam AI Studio

### Key Features

- **Access**: No signup — just enter the 4-digit view password for immediate access
- **Groups**: Create/join public or private groups, explore public groups
- **Content**: Save links (auto OG meta extraction) and notes with tags
- **Search**: Works from 1 character — Korean consonants, alphabets, and URL search (pg_trgm + ilike)
- **Detail View**: Bottom sheet with full content, thumbnail, tags, edit/delete
- **Toast Notifications**: Real-time feedback for save, edit, delete, error
- **Infinite Scroll**: IntersectionObserver-based auto-loading
- **Security**: SSRF defense, rate limiting, Zod validation, security headers

### Quick Start

```bash
git clone https://github.com/sodam-ai/knowledge-link-hub.git
cd knowledge-link-hub
npm install
cp .env.example .env.local   # Fill in your credentials
# Run SQL migrations 001-009 in Supabase Dashboard SQL Editor
npm run dev
# Visit http://localhost:3000, enter view password (default: 1234)
# Change passwords at /admin (default admin password: 12341234)
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Site URL (e.g., `http://localhost:3000`) |
| `VIEW_PASSWORD` | Yes | Initial 4-digit numeric view password |
| `ADMIN_PASSWORD` | Yes | Initial admin password (change at `/admin`) |
| `SESSION_SECRET` | Yes | HMAC secret for session signing (`openssl rand -hex 32`) |
| `UPSTASH_REDIS_REST_URL` | Recommended | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended | Upstash Redis token |
| `MICROLINK_API_KEY` | Optional | Microlink API for URL title extraction |

### Deployment

Deploy to Vercel:
1. Import repository at [vercel.com](https://vercel.com)
2. Add all environment variables in Vercel Dashboard
   - Generate a new `SESSION_SECRET` with `openssl rand -hex 32`
   - Change `VIEW_PASSWORD` and `ADMIN_PASSWORD` before going live
3. Run migrations 001–009 in your Supabase SQL Editor
4. After deploy, change passwords at `/admin`

### Security

- SSRF defense: blocks private IPs, loopback, cloud metadata endpoints (HTTPS-only)
- Rate limiting: OG extraction (20/min) via Upstash Redis
- All inputs validated with Zod + HTML sanitization
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- Session cookie: HttpOnly · SameSite=Strict · Secure (production)
- Password hashing: HMAC-SHA256 (Web Crypto API, timing-safe comparison)

---

## License

MIT License — Copyright (c) 2026 SoDam AI Studio

See [LICENSE](./LICENSE) for details.
