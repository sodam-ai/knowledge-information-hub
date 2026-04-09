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
- **인증**: 이메일/비밀번호 · Google · GitHub · Kakao · Naver OAuth
- **포트**: 개발 서버 `8002`
- **저작권**: SoDam AI Studio

---

## 주요 기능

### 인증
- 이메일 회원가입 / 로그인
- Google, GitHub, Kakao, Naver 소셜 로그인
- 안전한 세션 관리 (Supabase Auth + RLS)

### 그룹
- 그룹 생성 (공개 / 비공개)
- 초대 코드로 멤버 초대 (72시간 유효)
- 공개 그룹 탐색 페이지 (`/explore`)
- 카테고리 분류: AI / 개발 / 디자인 / 마케팅 / 학습 / 비즈니스 / 투자 / 기타
- 공개 그룹 최대 500명, 비공개 최대 20명
- 사용자 최대 10개 그룹 가입

### 콘텐츠
- 링크 저장 (URL 자동 제목 추출)
- 노트 저장 (텍스트)
- 태그 분류 (쉼표 구분, 최대 10개)
- 전체 / 링크 / 노트 필터 탭
- 그룹 내 전문 검색 (PostgreSQL pg_trgm)
- 소프트 삭제 (30일 내 복구 가능)
- 더 보기 (무한 로딩)

### 보안
- Row Level Security (RLS) 전면 적용
- SECURITY DEFINER 패턴으로 RLS 재귀 방지
- Rate Limiting (Upstash Redis, fail-open)
- 입력값 Zod 검증 + HTML 이스케이프 처리
- 초대 코드 정규식 검증

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

Supabase 대시보드 → SQL Editor에서 `supabase/migrations/` 폴더의 파일을 순서대로 실행:

```
001_init.sql
002_...
003_...
004_...
005_groups_upgrade.sql
```

### 5단계 — 개발 서버 시작

```bash
npm run dev -- -p 8002
```

브라우저에서 `http://localhost:8002` 접속

---

## 환경 변수 설정

`.env.local` 파일에 아래 값을 설정합니다.

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...  # 서버 전용, 절대 클라이언트에 노출 금지

# Upstash Redis — Rate Limiting (선택, 없으면 fail-open으로 동작)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=AX...

# Microlink.io — URL 제목 자동 추출 (선택, 없으면 URL을 제목으로 사용)
MICROLINK_API_KEY=

# Naver OAuth (선택)
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_CALLBACK_URL=http://localhost:8002/api/auth/naver/callback
```

> ⚠️ `.env.local`은 절대 git에 커밋하지 마세요. `.gitignore`에 이미 포함되어 있습니다.

---

## 폴더 구조

```
knowledge-link-hub/
├── src/
│   ├── actions/          # 서버 액션 (auth, items, teams)
│   ├── app/
│   │   ├── (auth)/       # 로그인, 회원가입 페이지
│   │   ├── (dashboard)/  # 대시보드, 온보딩, 설정
│   │   ├── api/          # Naver OAuth API 라우트
│   │   ├── explore/      # 공개 그룹 탐색 페이지
│   │   ├── join/         # 초대 코드 참여 페이지
│   │   └── share/        # 링크 공유 페이지
│   ├── components/
│   │   ├── items/        # ItemCard, ItemFeed, SaveItemButton, SearchBar
│   │   └── layout/       # TeamHeader
│   ├── lib/
│   │   ├── supabase/     # Supabase 클라이언트 (server, client, middleware)
│   │   ├── rate-limit/   # Upstash Redis Rate Limiter
│   │   ├── utils.ts
│   │   └── validations/  # Zod 스키마
│   ├── middleware.ts      # 인증 미들웨어
│   └── types/            # TypeScript 타입 정의
├── supabase/
│   └── migrations/       # SQL 마이그레이션 파일
├── .env.example          # 환경 변수 예시 (실제 값 없음)
├── .gitignore
└── package.json
```

---

## 배포 방법

### Vercel 배포 (권장)

1. [vercel.com](https://vercel.com)에서 프로젝트 Import
2. 환경 변수를 Vercel Dashboard → Settings → Environment Variables에 입력
3. `NEXTAUTH_URL` 또는 콜백 URL을 실제 도메인으로 업데이트
4. Supabase Dashboard → Authentication → URL Configuration에서 리다이렉트 URL 추가:
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
2. **마이그레이션 순서 준수** — SQL 파일 번호 순서대로 실행해야 합니다.
3. **Kakao/Naver OAuth** — 각 개발자 센터에서 앱 등록 및 리다이렉트 URL 등록 필요.
4. **Rate Limiting** — Upstash Redis 미설정 시 fail-open(제한 없음)으로 동작합니다. 운영 환경에서는 반드시 설정 권장.
5. **소프트 삭제** — 삭제된 항목은 30일 후 자동 정리되도록 DB Cron 설정 필요 (Supabase pg_cron).
6. **공개 그룹 콘텐츠** — 그룹 정보(이름/설명/카테고리)만 공개. 링크·노트는 멤버만 열람 가능.

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
- 이 페이지 상단 녹색 `Code` 버튼 → `Download ZIP` 클릭
- 압축 해제 후 폴더 이름을 기억해두세요

**3. 터미널에서 폴더 열기**
- Windows: 폴더 안에서 Shift+우클릭 → "PowerShell 창 열기" 또는 "터미널에서 열기"
- Mac: Finder에서 폴더 우클릭 → "서비스" → "폴더에서 새 터미널 열기"

**4. 설치 명령어 실행**
```
npm install
```
(인터넷 속도에 따라 1~3분 소요)

**5. Supabase 설정**
- [supabase.com](https://supabase.com) 회원가입 → 새 프로젝트 생성
- Project Settings → API에서 URL과 anon key 복사
- `.env.example` 파일을 `.env.local`로 복사하고, 복사한 값 붙여넣기

**6. 실행**
```
npm run dev -- -p 8002
```
브라우저에서 `http://localhost:8002` 접속!

---

## English Documentation

### Overview

**Knowledge Link Hub** is a group knowledge vault where teams, study groups, and communities can save links and notes together — like an internet café or open chat room, but for knowledge sharing.

- **Stack**: Next.js 15 · TypeScript · Supabase · Tailwind CSS
- **Auth**: Email/Password · Google · GitHub · Kakao · Naver OAuth
- **Copyright**: SoDam AI Studio

### Quick Start

```bash
git clone https://github.com/sodam-ai/knowledge-link-hub.git
cd knowledge-link-hub
npm install
cp .env.example .env.local   # Fill in your Supabase credentials
npm run dev -- -p 8002
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service role key (server-only) |
| `UPSTASH_REDIS_REST_URL` | ⚪ | Upstash Redis URL (rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | ⚪ | Upstash Redis token |
| `MICROLINK_API_KEY` | ⚪ | Microlink API for URL title extraction |
| `NAVER_CLIENT_ID` | ⚪ | Naver OAuth client ID |
| `NAVER_CLIENT_SECRET` | ⚪ | Naver OAuth client secret |

### Deployment

Deploy to Vercel:
1. Import repository at [vercel.com](https://vercel.com)
2. Add environment variables in Vercel Dashboard
3. Update redirect URLs in Supabase Authentication settings

### Security Notes

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the client
- All data access is protected by Supabase Row Level Security (RLS)
- Rate limiting via Upstash Redis (fails open if not configured)
- All inputs validated with Zod + HTML sanitization

---

## 라이선스 / License

MIT License — Copyright (c) 2026 SoDam AI Studio

자세한 내용은 [LICENSE](./LICENSE) 파일을 참고하세요.
