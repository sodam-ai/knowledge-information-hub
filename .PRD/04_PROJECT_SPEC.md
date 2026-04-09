# TeamVault — 프로젝트 스펙

> 최종 수정: 2026-04-09 v3.0
> AI가 코드를 짤 때 지켜야 할 규칙과 절대 하면 안 되는 것.
> 이 문서를 AI에게 항상 함께 공유하세요.
> **보안은 선택 사항이 아니라 핵심 요구사항입니다.**

---

## 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 프레임워크 | Next.js 15 (App Router) | AI 코딩 호환성 최고, 웹+모바일 반응형 동시 지원 |
| UI 컴포넌트 | Shadcn/UI + Tailwind CSS | 2026 표준 스택, 빠른 UI 구성 |
| DB / 백엔드 | Supabase (PostgreSQL) | 인증·저장소·DB·실시간 통합 제공, 무료 티어 충분 |
| 파일 저장 | Supabase Storage | DB와 동일 플랫폼, 설정 최소화 |
| 인증 | Supabase Auth | Google OAuth + GitHub OAuth + 이메일 내장 지원 |
| URL 추출 | microlink.io API | 제목·OG 메타태그 추출, SSRF 공격면 제로 |
| Rate Limiting | Vercel Edge Middleware + Upstash Redis | API 남용·비용 폭발 방지, 서버리스 친화적 |
| AI 검색 (P2~) | Supabase pgvector + OpenAI text-embedding-3-small | Postgres 안에서 벡터 검색 가능 |
| AI 태그/요약 (P3~) | OpenAI GPT-4o-mini | 비용 대비 성능 최적 |
| 배포 | Vercel | Next.js 제작사, GitHub push → 자동 배포 60초 |
| 이메일 알림 (P2~) | Resend | Next.js 생태계 표준, 무료 티어 3,000건/월 |
| 에러 모니터링 | Sentry | 배포 후 오류 즉시 감지, 무료 티어 5,000건/월 |

---

## 프로젝트 구조

```
teamvault/
├── src/
│   ├── app/                  # 페이지 (App Router)
│   │   ├── (auth)/           # 로그인·회원가입 페이지
│   │   ├── (dashboard)/      # 메인 대시보드, 검색, 상세
│   │   └── api/              # API 라우트 (서버 액션)
│   ├── components/
│   │   ├── ui/               # Shadcn/UI 기본 컴포넌트
│   │   ├── items/            # 콘텐츠 카드, 저장 폼
│   │   └── layout/           # 헤더, 사이드바, 모바일 바텀내비
│   ├── lib/
│   │   ├── supabase/         # DB 클라이언트, 쿼리 함수
│   │   ├── validations/      # 파일 MIME 타입 검증, 입력값 검증
│   │   ├── rate-limit/       # Upstash Redis rate limit 헬퍼
│   │   └── utils.ts          # 공통 유틸리티
│   ├── middleware.ts          # Vercel Edge: rate limiting, 인증 전처리
│   └── types/
│       └── index.ts          # Team, UserTeam, User, Item, Tag, Comment 타입 정의
├── public/
│   └── manifest.json         # PWA 매니페스트 (Phase 1)
├── .env.local                # 환경변수 (절대 GitHub에 올리지 마세요)
├── .env.example              # 환경변수 예시 (키 값 없이 키 이름만)
└── package.json
```

---

## 보안 설계 — 핵심 원칙

> **보안은 선택 사항이 아니라 핵심 요구사항입니다.**
> 모든 기능을 구현하기 전에 이 섹션을 반드시 읽고 설계에 반영하세요.

### 신뢰 경계 (Trust Boundaries) — 4계층 방어

```
[브라우저 / 외부 클라이언트]  ← 신뢰 안 함
        ↓
[Vercel Edge Middleware]       ← Rate Limit: IP당 요청 수 제한
        ↓
[Next.js 서버 액션]            ← 인증: Supabase Auth JWT 검증
        ↓
[Supabase RLS 정책]            ← 데이터 격리: team_id 기반 행 단위 접근 제어
        ↓
[PostgreSQL 데이터]            ← 최종 방어선
```

각 계층은 **독립적으로** 방어합니다. 상위 계층이 뚫려도 하위 계층이 막습니다.

**외부 URL 처리 신뢰 경계**:
```
[사용자 입력 URL]
        ↓
[서버 액션: URL만 microlink.io로 전달] ← 서버는 직접 fetch하지 않음
        ↓
[microlink.io]                          ← 격리된 외부 서비스가 fetch 대행
        ↓
[서버 액션: 제목/OG 데이터만 수신]     ← HTML/스크립트 절대 수신 안 함
```

---

## 보안 요구사항 상세

### 1. 팀 데이터 격리 (최우선)
- Supabase RLS(Row Level Security) 정책: `team_id` 기반으로 팀 간 데이터 완전 격리
- 모든 DB 쿼리에 `team_id` 필터 필수 — 빠뜨리면 다른 팀 데이터가 노출됨
- UserTeam 테이블 기준으로 현재 로그인한 사용자의 team_id만 접근 허용

### 2. 콘텐츠 권한 모델
- **수정 (UPDATE)**: 본인(`created_by = auth.uid()`)만 가능
- **소프트 삭제 (is_deleted=true)**: 본인 또는 팀 관리자(role='admin')만 가능
- **조회 (SELECT)**: 같은 팀원 전체 가능
- 이유: "내 글을 팀장이 몰래 수정"은 팀 신뢰 파괴. "쓰레기 글을 팀장이 삭제"는 정당한 관리.

```sql
-- RLS 방향 예시 (실제 구현 시 Supabase 대시보드에서 설정)
-- 수정: 본인만
-- 삭제: 본인 또는 admin
-- 조회: 같은 팀원
```

### 3. Rate Limiting (API 남용 방지)

Vercel Edge Middleware + Upstash Redis로 구현. 엔드포인트별 제한:

| 엔드포인트 | 제한 | 이유 |
|-----------|------|------|
| `POST /api/items` | 분당 20건/IP | 스팸 저장 방지 |
| `GET /api/search` | 분당 30건/IP | 검색 남용 방지 |
| `POST /api/teams/join` | 시간당 5건/IP | 초대 코드 브루트포스 방지 |
| `POST /api/teams` | 시간당 3건/IP | 팀 대량 생성 방지 |
| `POST /api/items/*/tags` | 분당 30건/IP | 태그 스팸 방지 |

> Phase 2~3에서 AI API 호출 엔드포인트 추가 시 반드시 더 엄격한 제한 적용.
> AI 기능 남용은 OpenAI API 비용 직접 폭발로 이어짐.

### 4. 초대 코드 보안
- `invite_code`: 생성 시 **최소 16자 이상** 무작위 문자열 (12자는 브루트포스 위험 — 16자로 상향)
- `invite_expires_at`: 72시간 유효
- 만료된 코드로 합류 시도 시 **명확한 오류 메시지** + Sentry 로깅
- 관리자(admin)만 코드 재발급 가능
- 합류 엔드포인트에 rate limit 필수 (시간당 5건/IP)
- 합류 성공/실패 이벤트를 Supabase 로그에 기록 (감사 로그)

### 5. SSRF 방지 (Server-Side Request Forgery)
- 서버에서 사용자 입력 URL을 직접 fetch **절대 금지**
- URL 제목 추출 및 OG 미리보기: **microlink.io API** 를 통해서만 처리
- **microlink.io 응답 데이터도 신뢰하지 마라**: 반환된 제목·설명·이미지 URL을 그대로 저장/렌더링 금지
  - 제목: 최대 500자로 절단, HTML 태그 제거, 특수문자 이스케이프
  - 설명: 최대 1,000자로 절단, HTML 태그 제거
  - 이미지 URL: HTTPS 스키마만 허용, javascript: / data: 스키마 차단
- 내부 네트워크 URL (`localhost`, `169.254.*`, `10.*`, `192.168.*`) 입력 시 저장 전 서버에서 차단

### 6. 파일 업로드 보안 (Phase 1.5~)
- **서버사이드에서 MIME 타입 검증 필수** (클라이언트 검증만으로는 부족)
- **Content-Type 헤더를 신뢰하지 마라**: 사용자가 조작 가능 — 반드시 **파일 매직 바이트(magic bytes)** 로 실제 파일 타입 검증
  - 예: PNG는 `89 50 4E 47`, PDF는 `25 50 44 46`으로 시작
  - `file-type` npm 패키지 사용 권장 (magic bytes 기반 검증)
- 허용 MIME 목록 (`lib/validations/` 에 상수로 정의):
  - `application/pdf`
  - `image/png`, `image/jpeg`, `image/gif`, `image/webp`
  - `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
  - `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  - `text/plain`
- **Office 문서(.docx, .xlsx)는 ZIP 기반 — 매크로 포함 가능**: 파일은 절대 서버에서 렌더링/실행하지 말고 다운로드 전용으로만 제공
- 파일 크기 제한: 건당 최대 20MB, 팀 전체 1GB
- 실행 파일(.exe, .sh, .bat, .ps1, .cmd 등) **절대 허용 금지**
- Supabase Storage 버킷은 **private** 설정 (인증된 팀원만 접근)
- 파일 다운로드는 서버 액션을 통한 서명된 임시 URL (signed URL, 유효기간 1시간) 사용
- 파일은 브라우저 인라인 렌더링 금지 — `Content-Disposition: attachment` 헤더 강제

### 7. 소프트 삭제 (데이터 보호)
- 삭제 시 `is_deleted = true`, `deleted_at = now()` 기록
- 모든 목록 조회 쿼리에 `WHERE is_deleted = false` 필터 필수
- 30일 후 Supabase Edge Function 또는 배치로 영구 삭제
- 영구 삭제 전 해당 Item의 파일(Supabase Storage)도 함께 삭제

### 8. API 보안 + 서비스 키 사용 정책

**SUPABASE_SERVICE_ROLE_KEY 사용 정책** (RLS 우회 키 — 남용 시 데이터 격리 무효화):
- 허용: 서버 측 배치 작업, Supabase Edge Function (30일 영구 삭제 배치 등)
- **금지**: 사용자가 직접 트리거하는 모든 서버 액션
- 모든 사용자 요청 처리 서버 액션은 **사용자 JWT(세션 토큰)** 를 Supabase 클라이언트에 전달해야 함
- 이유: service role key를 사용자 요청에 쓰면 RLS가 완전히 무력화됨

**일반 API 보안**:
- 모든 서버 액션 첫 줄에서 Supabase Auth 세션 검증 필수
- OpenAI API 키, Upstash 키 등 외부 서비스 키는 서버 액션에서만 호출
- API 응답에서 민감한 내부 정보(스택 트레이스, DB 오류 메시지 원문) 클라이언트에 노출 금지
- 에러 발생 시 사용자에게는 친절한 한국어 메시지, 서버 로그에 상세 내용 기록

### 9. OAuth 계정 연결 정책
- Google / GitHub / 이메일+비밀번호 세 가지 인증 방식 지원
- **동일 이메일 주소로 다른 인증 방식 사용 시**: Supabase Auth의 기본 동작(이메일 기반 자동 연결) 사용
- 이메일+비밀번호로 가입 후 같은 이메일로 Google 로그인 시도 → 동일 계정으로 연결
- **단, 이메일 미인증 상태에서 OAuth 계정 자동 연결 금지** — Supabase 프로젝트 설정에서 `email_autoconfirm` 비활성화 권장

### 10. 세션 무효화 (팀 탈퇴/추방 시)
- Supabase JWT는 기본적으로 stateless → 팀에서 추방해도 JWT 만료 전까지 접근 가능
- 대응 방향: 팀 탈퇴/추방 시 해당 사용자의 Supabase 세션을 서버에서 강제 만료 (Admin API 사용)
- RLS 정책이 UserTeam 테이블을 실시간으로 조회하도록 설계하면 JWT 유효 여부와 무관하게 차단 가능
- Phase 1에서는 RLS가 UserTeam 기반으로 실시간 확인하는 구조로 설계 (JWT 캐시 문제 완화)

### 11. 보안 감사 로그
- 다음 이벤트는 서버 로그 + Sentry에 기록 필수:
  - 초대 코드 합류 성공 / 실패
  - 초대 코드 재발급 (admin)
  - 팀원 추방 (admin)
  - 소프트 삭제 실행 (특히 admin이 타인 콘텐츠 삭제 시)
  - Rate limit 초과 (IP + 엔드포인트)
  - 인증 실패 반복 (5회 이상/분)
  - **계정 탈퇴 + 익명화 실행** (누가, 언제, 어느 팀 소속이었는지)

### 12. 팀 관리자 승계 정책 (Admin Succession)

**문제**: 유일한 관리자가 팀을 떠나면 초대 코드 재발급·팀원 추방 불가 → 팀 사실상 잠김

**두 케이스 분리 처리**:

**케이스 1 — 관리자가 자발적으로 팀 탈퇴(leave)**:
- 팀에 다른 멤버가 있으면 탈퇴 전 반드시 다른 멤버를 admin으로 승격해야 함
- 승격 없이 탈퇴 시도 → 차단 + "다른 팀원을 관리자로 지정한 후 탈퇴할 수 있어요" 안내
- 팀에 본인만 남아 있는 경우 → 팀 전체 삭제 후 탈퇴 허용

**케이스 2 — 관리자가 계정 탈퇴(account deletion)**:
- 계정 삭제 트랜잭션 내에서 해당 팀의 가장 오래된 멤버(joined_at 기준)를 자동으로 admin 승격
- 팀에 다른 멤버가 없으면 팀 전체 소프트 삭제
- 자동 승격된 멤버에게 "관리자로 지정되었습니다" 다음 로그인 시 안내

**보안 관점**: 관리자 없는 팀은 초대 코드를 재발급할 수 없어 사실상 잠금 상태. 새 멤버 합류 불가 + 기존 멤버 추방 불가 → 운영 리스크.

---

### 13. 외부 서비스 장애 폴백 설계

**microlink.io 장애 시 폴백 (Graceful Degradation)**:
- microlink.io 호출 실패(타임아웃 3초, 오류 응답) 시 → URL 자체를 임시 제목으로 저장
- UI: "제목 자동 추출에 실패했어요. 직접 수정할 수 있어요" 인라인 안내
- 링크 저장 자체는 항상 성공 → 외부 서비스 장애가 핵심 기능 마비로 이어지지 않음
- 이후 사용자가 제목을 직접 수정하면 정상 저장

**Upstash Redis 장애 시 폴백**:
- Rate limiting 미들웨어가 Redis 연결 실패 시 → fail-open (요청 허용) 또는 fail-closed (요청 차단) 선택 필요
- **권장: fail-open** — Redis 장애 중 서비스 전체를 차단하는 것보다 일시적 rate limit 해제가 덜 위험
- 단, Redis 장애 이벤트는 Sentry에 즉시 알림

**Supabase 장애 시**:
- 인프라 장애이므로 TeamVault 전체 서비스 불가 — Vercel Status Page 확인 안내 페이지 표시

---

### 14. 계정 탈퇴 + 데이터 익명화 (Privacy by Design)

**설계 원칙**: 탈퇴 = PII(개인식별정보) 즉시 제거 + 팀 콘텐츠 유지

**탈퇴 처리 순서** (원자적 트랜잭션으로 실행):
1. User.email → `deleted-{uuid}@teamvault.invalid`
2. User.name → `[탈퇴한 사용자]`, User.avatar_url → null
3. User.is_anonymized = true, User.anonymized_at = now()
4. **Item.created_by → NULL** (UUID 연결 해제 — 행동 패턴 재식별 방지)
5. 모든 UserTeam 레코드: left_at = now()
6. 원본 이메일의 SHA-256 해시를 `DeletedEmails` 테이블에 저장 (90일 차단)
7. Supabase Auth 계정 삭제 (Admin API 사용 — service role key 필요)
8. 감사 로그 기록 (원본 이메일/이름 절대 로그에 포함 금지)

**왜 created_by를 NULL로 설정하는가**:
- UUID를 유지하면 이름/이메일 없이도 "이 UUID가 만든 모든 콘텐츠" 열거 가능 → 행동 패턴 재식별
- NULL로 설정하면 콘텐츠는 "익명의 팀원이 저장"으로 표시되어 재식별 불가

**재가입 차단 (CRITICAL)**:
- 동일 이메일 재가입 시 초대 흐름·SSO에서 이전 계정과 연결될 위험 존재
- 탈퇴 시 원본 이메일의 SHA-256 해시를 `DeletedEmails`에 기록
- 재가입 시 이메일 해시 조회 → 90일 이내면 가입 차단 + 안내 메시지
- 해시만 저장 (원본 이메일 미보관 — PII 최소화)
- 90일 후 `DeletedEmails` 레코드도 삭제

**법적 근거**: 국내 개인정보보호법 제36조 (삭제 요구권), EU GDPR Article 17 (Right to Erasure)

**보안 리스크**:
- 탈퇴 처리 중 실패 시 부분 익명화 → 반드시 트랜잭션으로 묶어서 전부 성공 또는 전부 롤백
- 서버 로그·감사 이벤트에 원본 이메일이 기록되지 않도록 코드 레벨에서 검증 필수
- 백업 데이터에 PII가 남을 수 있음 → 백업 암호화 + 보관 기간 정책 필요 (운영 리스크)

### 15. 팀 규모 하드 리밋 (리소스 남용 방지)

- **팀당 최대 멤버**: 20명
- **사용자당 최대 소속 팀**: 5개
- Rate limiting과 독립 동작 — 천천히 팀을 대량 생성하는 남용 패턴도 차단
- 초과 시 HTTP 422 + 한국어 안내 메시지 반환
- 향후 유료 플랜에서 이 제한을 높이는 방식으로 수익화 가능

**경쟁 조건(Race Condition) 방지 — 서버 액션 단독 검증은 불충분**:
- 서버 액션에서 count 확인 후 INSERT 사이에 동시 요청이 들어오면 20명 제한 초과 가능
- 반드시 **DB 레벨 CHECK 제약 조건 또는 트리거**로 최종 방어선 구축:
  ```sql
  -- 방향 예시 (Supabase Migration으로 적용)
  -- UserTeam INSERT 시 team_id 기준 count 20 초과 차단
  -- Team INSERT 시 user_id 기준 count 5 초과 차단
  ```
- 서버 액션 검증(사용자 친화적 오류 메시지) + DB 제약(최종 방어) 이중 적용
- DB 제약 위반 시 Supabase에서 23514 오류 코드 반환 → 서버 액션에서 잡아서 한국어 메시지로 변환

### 16. 성능 목표 (SLA)

| 작업 | 목표 (p95) | 측정 방법 |
|------|-----------|---------|
| 아이템 목록 로딩 (첫 20개) | < 1초 | Vercel Analytics |
| 검색 응답 (서버 기준) | < 500ms | Vercel Analytics |
| 검색 응답 (클라이언트 렌더 완료) | < 2초 | Vercel Analytics |
| 링크 저장 (microlink.io 포함) | < 3초 | Vercel Analytics |
| 파일 업로드 20MB (Phase 1.5) | < 30초 | Vercel Analytics |

> Vercel Analytics는 Phase 1 배포 직후부터 활성화. 실측값 기준으로 목표 재조정.
> SLA 미달 시 Sentry Performance 알림 설정.

### 9. 입력값 검증
- 모든 사용자 입력: 서버 액션에서 **Zod 스키마** 로 검증
- URL 필드: 유효한 HTTP/HTTPS URL만 허용 (javascript: 스키마 차단)
- 태그 이름: 최대 30자, 특수문자 제한
- 팀 이름: 최대 50자
- 노트 내용: 최대 50,000자 (DB 과부하 방지)
- 검색어: 최대 200자, SQL 인젝션은 파라미터 바인딩으로 방지 (절대 문자열 직접 삽입 금지)

### 10. 위협 모델 요약

| 위협 | 경로 | 방어 계층 | 심각도 |
|------|------|----------|--------|
| 타 팀 데이터 접근 | 직접 API 호출 | RLS + team_id 필터 | 🔴 치명 |
| service role key로 RLS 우회 | 잘못된 서버 액션 설계 | 사용 정책 명시 (배치 전용) | 🔴 치명 |
| 초대 코드 브루트포스 | 반복 합류 시도 | Rate limit (5/시간) + 16자 코드 | 🔴 높음 |
| SSRF 공격 | 악의적 URL 입력 | microlink.io 위임 + 내부IP 차단 | 🔴 높음 |
| microlink.io 응답 XSS | OG 데이터에 스크립트 포함 | 응답 데이터 출력 전 위생 처리 | 🔴 높음 |
| API 비용 폭발 | AI 엔드포인트 남용 | Rate limit (엄격) | 🟠 높음 |
| 악성 파일 업로드 | 파일 저장 | magic bytes 검증 + private 버킷 | 🟠 높음 |
| Office 매크로 실행 | .docx/.xlsx 인라인 렌더링 | 다운로드 전용 + Content-Disposition | 🟠 높음 |
| 권한 없는 콘텐츠 수정 | 직접 API 호출 | RLS (본인만 UPDATE) | 🟠 높음 |
| 서비스 키 노출 | 클라이언트 번들 | 서버 액션 분리 + 빌드 검사 | 🟠 높음 |
| 추방된 팀원의 지속 접근 | JWT 만료 전 유효 | RLS가 UserTeam 실시간 조회 | 🟠 높음 |
| OAuth 계정 탈취 | 동일 이메일 자동 연결 | 이메일 인증 필수 후 연결 | 🟠 높음 |
| 탈퇴 후 동일 이메일 재가입 | 초대·SSO 흐름 재연결 | DeletedEmails 해시 차단 테이블 (90일) | 🔴 높음 |
| created_by UUID로 행동 재식별 | DB 직접 쿼리 | 탈퇴 시 created_by → NULL | 🟠 높음 |
| 팀 리밋 경쟁 조건 | 동시 합류 요청 | DB CHECK 제약 + 서버 액션 이중 검증 | 🟠 높음 |
| 로그/백업에 PII 잔류 | 탈퇴 후 로그 조회 | 감사 로그에 원본 이메일 기록 금지 | 🟡 중간 |
| 삭제 데이터 노출 | is_deleted 필터 누락 | RLS 레벨에서 강제 적용 | 🟡 중간 |
| 세션 하이재킹 | 토큰 탈취 | Supabase Auth JWT (httpOnly) | 🟡 중간 |
| 감사 로그 부재 | 보안 이벤트 미기록 | Sentry + 서버 로그 필수 이벤트 명시 | 🟡 중간 |

---

## 절대 하지 마 (DO NOT)

> AI에게 코드를 시킬 때 이 목록을 반드시 함께 공유하세요.

**보안 관련**
- [ ] 서버에서 사용자 입력 URL을 직접 fetch하지 마 (SSRF 위험 — microlink.io 사용)
- [ ] microlink.io 응답 데이터를 그대로 저장하거나 렌더링하지 마 (출력 전 위생 처리 필수)
- [ ] Rate limiting 없이 API 엔드포인트를 열지 마 (비용 폭발 + 브루트포스 위험)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`를 사용자 요청 처리 서버 액션에서 사용하지 마 (RLS 무효화 위험 — 배치 작업 전용)
- [ ] `SUPABASE_SERVICE_ROLE_KEY`를 클라이언트 컴포넌트에서 사용하지 마
- [ ] API 키·비밀번호를 코드에 직접 쓰지 마 (`.env.local` 사용)
- [ ] `.env.local` 파일을 GitHub에 커밋하지 마
- [ ] 사용자 입력을 Zod 검증 없이 DB에 저장하지 마
- [ ] 에러 스택 트레이스나 DB 오류 원문을 클라이언트에 노출하지 마
- [ ] 파일 업로드 시 Content-Type 헤더만 믿지 마 (magic bytes 검증 필수)
- [ ] Office 문서(.docx, .xlsx)를 서버에서 렌더링하지 마 (다운로드 전용)
- [ ] 파일을 브라우저 인라인으로 열지 마 (Content-Disposition: attachment 강제)
- [ ] invite_code 만료 검증 없이 팀 합류를 허용하지 마
- [ ] 내부 IP 주소(localhost, 169.254.*, 10.*, 192.168.*)를 URL로 저장하지 마
- [ ] Supabase Storage 버킷을 public으로 설정하지 마 (signed URL 사용)
- [ ] 이메일 미인증 상태의 OAuth 계정을 기존 계정에 자동 연결하지 마
- [ ] 보안 이벤트(합류 시도, 추방, 코드 재발급, 계정 탈퇴)를 로그 없이 처리하지 마
- [ ] 팀원 수 제한(20명) 없이 UserTeam에 INSERT하지 마
- [ ] 사용자당 팀 수 제한(5개) 없이 Team을 생성하지 마
- [ ] 계정 탈퇴를 트랜잭션 없이 처리하지 마 (부분 익명화 방지)
- [ ] 탈퇴 시 created_by UUID를 유지하지 마 (행동 패턴 재식별 방지 — NULL로 설정)
- [ ] 탈퇴 후 실제 이메일이 DB 어디에도 남지 않았는지 확인 없이 완료 처리하지 마
- [ ] 감사 로그·이벤트에 원본 이메일/이름을 기록하지 마 (SHA-256 해시만 허용)
- [ ] DeletedEmails 테이블 없이 탈퇴 이메일로 재가입을 허용하지 마
- [ ] 팀 규모 제한을 서버 액션 레벨에서만 검증하지 마 (DB CHECK 제약 필수)
- [ ] 마지막 관리자가 다른 멤버 없이 팀을 탈퇴하도록 허용하지 마 (팀 잠김 방지)
- [ ] 계정 삭제 시 팀 관리자 승계 없이 익명화를 완료하지 마
- [ ] microlink.io 실패 시 링크 저장 전체를 차단하지 마 (URL을 임시 제목으로 저장)

**데이터 관련**
- [ ] 목업/하드코딩 데이터로 완성이라고 하지 마 (실제 Supabase 연결 필수)
- [ ] 하드코딩된 user_id나 team_id를 쓰지 마 (Supabase Auth의 실제 세션 사용)
- [ ] 기존 DB 스키마를 임의로 변경하지 마 (migration 파일로 관리)
- [ ] team_id 필터 없이 Item을 조회하지 마 (다른 팀 데이터 노출 위험)
- [ ] is_deleted 필터 없이 Item을 조회하지 마 (삭제된 항목 노출 위험)
- [ ] `any` 타입을 TypeScript에서 쓰지 마 (types/index.ts의 타입 사용)

**범위 관련**
- [ ] Phase 2~3 기능(AI 검색, 자동 태그, PDF 요약, 댓글)을 Phase 1에서 구현하지 마
- [ ] package.json의 기존 의존성 버전을 임의로 변경하지 마

---

## 항상 해 (ALWAYS DO)

**보안 관련**
- [ ] 모든 서버 액션 첫 줄에서 Supabase Auth 세션 검증
- [ ] 모든 사용자 입력을 Zod 스키마로 검증 후 처리
- [ ] Rate limiting 미들웨어가 동작하는지 확인 후 엔드포인트 추가
- [ ] 외부 URL 처리는 microlink.io API를 통해서만
- [ ] Sentry 에러 리포팅 코드 포함 (try/catch 블록에서 Sentry.captureException)
- [ ] 파일 업로드 시 크기·MIME 형식 검증 (클라이언트 + 서버 양쪽)

**개발 관련**
- [ ] 변경하기 전에 계획을 먼저 보여줘
- [ ] 환경변수는 반드시 `.env.local`에 저장
- [ ] 모든 DB 쿼리에 `team_id` 필터 + `is_deleted = false` 적용
- [ ] 에러가 발생하면 사용자에게 친절한 한국어 메시지 표시
- [ ] 모바일에서도 사용 가능한 반응형 디자인 (Tailwind의 `sm:` 브레이크포인트)
- [ ] Supabase RLS 정책 설정 확인 후 코드 작성
- [ ] 로딩 상태와 에러 상태를 UI에 반드시 표시

---

## 검색 구현 방향

### Phase 1: pg_trgm + tsvector 병행 (한국어 최적화)

한국어는 형태소가 분리되지 않으면 pg_trgm만으로는 "인공지능"과 "AI 기술"을 연결 못함.
두 인덱스를 병행해서 검색 품질을 보완.

```sql
-- pg_trgm: 부분 문자열 매칭 (오타 허용, 영어 특히 효과적)
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_items_title_trgm ON items USING GIN (title gin_trgm_ops);
CREATE INDEX idx_items_content_trgm ON items USING GIN (content gin_trgm_ops);

-- tsvector: 공백 기반 단어 단위 검색 (한국어 어절 단위 검색 개선)
CREATE INDEX idx_items_search ON items USING GIN (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
);
```

- 검색 범위: **제목 + 본문 + 태그 이름** (태그 검색 포함 필수)
- 한국어 최소 검색어 길이: 2자 이상 (1자 단독 검색 비활성화)
- 검색 결과 정렬: pg_trgm similarity 점수 기준 내림차순

### Phase 2: pgvector 의미 검색 추가
- `search_vector` 컬럼 (tsvector): 저장 시 자동 업데이트 트리거
- `embedding` 컬럼 (vector): OpenAI text-embedding-3-small 결과 저장
- 두 검색 결과를 RRF(Reciprocal Rank Fusion)로 통합
- 의미 검색이 한국어 형태소 분석 부재를 보완 (Phase 2의 핵심 가치)

---

## 테스트 방법

```bash
# 로컬 실행
npm run dev
# → http://localhost:3000

# 타입 체크
npx tsc --noEmit

# 린트 체크
npm run lint

# 빌드 확인
npm run build
```

---

## 배포 방법 (Vercel)

1. GitHub에 저장소 생성 후 코드 push
2. [vercel.com](https://vercel.com) → New Project → GitHub 저장소 선택
3. 환경변수 아래 목록을 Vercel 대시보드에 입력
4. Deploy 클릭 → 자동 배포 완료
5. Sentry 프로젝트 연결 (Vercel Integration 활용)
6. Upstash Redis 생성 → Vercel 환경변수에 연결

---

## 환경변수

| 변수명 | 설명 | 어디서 발급 | Phase |
|--------|------|------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | Supabase 대시보드 → Settings → API | P1~ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 | Supabase 대시보드 → Settings → API | P1~ |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 키 (서버 액션에서만) | Supabase 대시보드 → Settings → API | P1~ |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry 에러 추적 키 | sentry.io → 프로젝트 생성 | P1~ |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis 엔드포인트 | upstash.com → Redis 생성 | P1~ |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis 인증 토큰 | upstash.com → Redis 생성 | P1~ |
| `MICROLINK_API_KEY` | microlink.io API 키 (무료 1,000건/월, 유료 무제한) | microlink.io | P1~ |
| `OPENAI_API_KEY` | OpenAI API 키 | platform.openai.com | P2~ |
| `RESEND_API_KEY` | 이메일 발송 키 | resend.com | P2~ |

> `.env.local` 파일에 저장. 절대 GitHub에 올리지 마세요.
> `.env.example`에는 키 이름만 적어두고 값은 비워두세요.

---

## [NEEDS CLARIFICATION]

- [ ] microlink.io 무료 티어(1,000건/월) 초과 시 유료 플랜($99/월) 사용 여부 — 아니면 대안 서비스?
- [ ] Upstash Redis 무료 티어(10,000 commands/day) 초과 예상 시기?
- [ ] Rate limit 초과 시 사용자 메시지: "잠시 후 다시 시도해주세요" 문구 확정?
- [ ] Supabase Storage 버킷 이름 확정 (`teamvault-files` 권장)
