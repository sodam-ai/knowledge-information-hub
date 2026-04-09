# TeamVault — Phase 분리 계획

> 최종 수정: 2026-04-09 v3.0
> 한 번에 다 만들면 복잡해져서 품질이 떨어집니다.
> Phase별로 나눠서 각각 "진짜 동작하는 제품"을 만듭니다.

---

## Phase 분리 원칙

- **Phase 1 (MVP)**: 가장 적은 기능으로 팀이 실제로 쓸 수 있는 상태
- **Phase 완료 조건**: 기술 체크리스트 + 사용 기준 둘 다 충족해야 다음 Phase 진입
- **Phase 간 되돌아보기**: 다음 Phase 시작 전 팀원 피드백 1회 필수
- **보안은 모든 Phase에서 핵심 요구사항**: 새 기능 추가 시 보안 검토 필수

---

## Phase 1: MVP — 링크·노트 창고 (핵심 기반)

### 목표
팀원이 가입하고, 링크와 노트를 저장하고, 팀과 공유하고, 키워드로 검색할 수 있다.
"우리 팀 창고"가 실제로 동작하는 최소 상태.

> **범위를 줄인 이유**: 4종 전부 + 파일 업로드까지 Phase 1에 넣으면 개발 기간이 2배 늘어나고,
> 실제로 링크+노트만으로도 팀 사용 가치를 충분히 검증할 수 있습니다.

### 기능
- [ ] 팀 회원가입 / 로그인 (소셜: Google, GitHub + 이메일+비밀번호)
- [ ] 팀 생성 + 초대 링크 발급 (16자 코드, 72시간 만료)
- [ ] 초대 링크로 팀원 합류 (rate limit: 시간당 5건/IP, 팀원 20명 초과 시 차단)
- [ ] 팀 규모 하드 리밋: 팀당 최대 20명, 사용자당 최대 5팀
- [ ] 콘텐츠 저장: 링크 북마크 (URL 입력 → microlink.io로 제목 자동 추출)
- [ ] 콘텐츠 저장: 텍스트 노트 (자유 입력, 최대 50,000자)
- [ ] URL 중복 감지 (url_hash 기반 — 경고 토스트, 강제 차단 아님)
- [ ] 팀 내 콘텐츠 목록 공유 보기 (최신순 피드)
- [ ] 수동 태그 추가/수정
- [ ] 키워드 기본 검색 (제목·내용·태그 포함, pg_trgm + tsvector 병행, 최소 2자)
- [ ] 소프트 삭제 (30일 복구 가능)
- [ ] 모바일 반응형 웹 지원
- [ ] PWA 설치 지원 (manifest.json + Service Worker → 모바일 홈 화면 추가, Web Share Target API)
- [ ] 첫 실행 경험: 샘플 콘텐츠 3개 자동 생성 (팀 생성 직후)
- [ ] 계정 탈퇴 + 데이터 익명화 (PII 즉시 삭제, 팀 콘텐츠 유지)
- [ ] 팀 관리자 승계: 마지막 admin 탈퇴 차단 + 계정 삭제 시 최고참 멤버 자동 승격
- [ ] microlink.io 장애 시 폴백: URL을 임시 제목으로 저장, "제목 추출 실패" 안내

### 보안 필수 항목 (Phase 1)
- [ ] Vercel Edge Middleware + Upstash Redis rate limiting 활성화
- [ ] Supabase RLS 정책: team_id 기반 행 단위 격리
- [ ] microlink.io API 통해서만 외부 URL 처리 (서버 직접 fetch 금지)
- [ ] Zod 스키마로 모든 입력값 검증
- [ ] SUPABASE_SERVICE_ROLE_KEY 서버 액션에서만 사용
- [ ] Supabase Storage 버킷 private 설정 + signed URL 사용

### 데이터
Team, User, UserTeam (invited_by, left_at 포함), Item (link/note 2종, url_hash, is_pinned, view_count 포함), Tag, ItemTag 사용

### 인증
- Supabase Auth: Google OAuth + GitHub OAuth + 이메일+비밀번호

### "진짜 제품" 체크리스트 (기술)
- [ ] 실제 Supabase DB 연결 (목업 데이터 X)
- [ ] 실제 인증 동작 (하드코딩된 비밀번호 X)
- [ ] Rate limiting 동작 확인 (초과 시 429 응답)
- [ ] Vercel에 실제 배포 (localhost X)
- [ ] 다른 사람이 URL로 접속해서 써볼 수 있음
- [ ] 팀원 2명이 각자 다른 기기에서 동시에 접속 가능
- [ ] 초대 코드 만료 동작 확인 (72시간 후 오류 처리)
- [ ] 소프트 삭제 후 목록에서 사라지는 것 확인
- [ ] 다른 팀 데이터가 조회되지 않는 것 확인 (RLS 검증)
- [ ] microlink.io 제목 추출 동작 확인
- [ ] PWA 홈 화면 추가 + Web Share Target 동작 확인

### Phase 1 완료 조건 (다음 Phase 진입 기준)
**기술**: 위 체크리스트 전부 통과
**사용**: 아래 중 2개 이상 달성
- [ ] 팀이 자발적으로 콘텐츠 20개 이상 저장
- [ ] 3일 연속 팀원 중 누군가가 앱을 열었음
- [ ] "검색해서 찾았다"는 경험이 1회 이상 발생

### Phase 1 시작 프롬프트

```
이 PRD를 읽고 Phase 1을 구현해주세요.
@PRD/01_PRD.md
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 1 범위:
- 팀 회원가입/로그인 (Google OAuth + GitHub OAuth + 이메일+비밀번호)
- 팀 생성 + 초대 링크 (16자 코드, 72시간 만료)
- 팀 규모 하드 리밋: 팀당 최대 20명, 사용자당 최대 5팀
- 콘텐츠 저장 2종: 링크(microlink.io로 제목 추출) / 노트
- URL 중복 감지 (url_hash SHA-256, 경고 토스트)
- 팀 공유 목록 보기 (최신순)
- 수동 태그
- 키워드 검색 (제목+내용+태그, pg_trgm + tsvector 병행, 최소 2자)
- 소프트 삭제 (is_deleted 필드, RLS 레벨 적용)
- 계정 탈퇴 + 데이터 익명화 (PII 즉시 삭제, 트랜잭션으로 처리)
- 모바일 반응형 + PWA (manifest.json + Web Share Target)
- 첫 실행 샘플 콘텐츠 3개 자동 생성
- Vercel Analytics 활성화 (성능 SLA 측정용)

반드시 지켜야 할 보안 요구사항 (04_PROJECT_SPEC.md 보안 섹션 전체 준수):
- Vercel Edge Middleware + Upstash Redis rate limiting 구현
- 서버에서 외부 URL 직접 fetch 금지 → microlink.io API만 사용
- microlink.io 응답 데이터 위생 처리 (HTML 제거, 길이 절단)
- 모든 입력값 Zod 스키마 검증
- SUPABASE_SERVICE_ROLE_KEY: 배치 작업 전용, 사용자 요청 처리에 사용 금지
- Supabase RLS team_id 기반 격리 (is_deleted 조건도 RLS 레벨에서 적용)
- 계정 탈퇴: 원자적 트랜잭션 (User 익명화 + Item.created_by→NULL + DeletedEmails 해시 저장 + Auth 삭제)
- 탈퇴 이메일 재가입 차단: DeletedEmails 테이블에 SHA-256 해시 저장, 재가입 시 확인
- 감사 로그에 원본 이메일/이름 절대 기록 금지 (해시만 허용)
- 팀 규모 제한: 서버 액션 count 확인 + DB CHECK 제약 조건 이중 적용
- 관리자 승계: 마지막 admin 탈퇴 차단 / 계정 삭제 시 최고참 멤버 자동 admin 승격
- microlink.io 장애 시: 타임아웃 3초 후 URL을 임시 제목으로 저장 (링크 저장 차단 금지)
- 파일 업로드, AI 대화 저장, 댓글, AI 검색은 이 Phase에 넣지 말 것
```

---

## Phase 1.5: 파일·AI 대화 (콘텐츠 확장)

### 전제 조건
- Phase 1 완료 조건 달성
- 팀이 "파일도 올리고 싶다"는 피드백 확인

### 목표
링크·노트에 파일 업로드와 AI 대화 저장을 추가해 4종 완성.

### 기능
- [ ] 콘텐츠 저장: 파일 업로드 (PDF, 이미지, Office — MIME 허용 목록 + magic bytes 검증)
- [ ] 파일 크기 제한 (건당 20MB, 팀 전체 1GB)
- [ ] 콘텐츠 저장: AI 대화 텍스트 붙여넣기 (ai_chat 타입)
- [ ] 파일 미리보기 (이미지는 인라인, PDF는 링크)
- [ ] 파일 다운로드 (서버 액션 통한 signed URL, 유효기간 1시간, Content-Disposition: attachment)
- [ ] 브라우저 북마크 가져오기 (HTML bookmark 파일 → 최대 100건 배치 저장)
- [ ] 팀 데이터 내보내기 (JSON 형식 — 제목, URL, 내용, 태그, 저장일)

### 보안 필수 항목 (Phase 1.5 추가)
- [ ] 서버사이드 MIME 타입 검증 (클라이언트 검증만으로 부족)
- [ ] 실행 파일 확장자(.exe, .sh, .bat, .ps1) 업로드 차단
- [ ] Supabase Storage 버킷 private 유지 + signed URL (공개 URL 절대 사용 금지)
- [ ] 팀 전체 저장 용량 1GB 초과 시 업로드 차단 + 안내 메시지

### 추가 데이터
- Item.file_path, Item.file_mime 활성화
- Supabase Storage 연동

### Phase 1.5 시작 프롬프트

```
Phase 1이 완료된 상태에서 Phase 1.5를 구현해주세요.
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 1.5 범위:
- 파일 업로드 (Item.type = 'file')
- AI 대화 저장 (Item.type = 'ai_chat')
- 파일 미리보기 + 다운로드 (signed URL, Content-Disposition: attachment)
- 브라우저 북마크 가져오기 (HTML bookmark 파일 파싱 → 최대 100건 배치 저장)
- 팀 데이터 내보내기 (JSON 형식: 제목, URL, 내용, 태그, 저장일)

반드시 지켜야 할 보안 요구사항:
- Content-Type 헤더 신뢰 금지 → magic bytes (file-type 패키지) 검증 필수
- 허용 MIME 목록 외 파일 차단 (04_PROJECT_SPEC.md 참조)
- 실행 파일 차단 (.exe, .sh, .bat, .ps1, .cmd)
- Supabase Storage private 버킷 유지
- 파일 다운로드: 서버 액션 통한 signed URL (공개 URL 절대 금지)
- 파일 브라우저 인라인 렌더링 금지 (Content-Disposition: attachment 강제)
- 팀 전체 1GB 초과 시 업로드 차단 + 명확한 안내
- 북마크 가져오기: 클라이언트에서 HTML 파싱, 서버는 기존 Item 저장 API 재사용 (새 API 불필요)
- 내보내기: 팀원만 접근 가능, 민감 정보(is_deleted=true 항목) 제외
- Phase 1 기능(링크, 노트, 검색, 태그, 인증, 계정 탈퇴)은 그대로 유지
```

---

## Phase 2: 확장 — AI + 협업 강화

### 전제 조건
- Phase 1(+1.5)이 Vercel에 안정적으로 배포된 상태
- 팀당 콘텐츠 30개 이상 쌓인 상태 (AI 검색이 의미있는 시점)

### 목표
AI로 더 스마트하게 검색하고, 팀 협업 기능을 강화한다.

### 기능
- [ ] AI 스마트 검색 (자연어 질문 방식, Supabase pgvector + OpenAI)
- [ ] 링크 자동 미리보기 (OG 메타태그 기반 썸네일+제목 — microlink.io Phase 2에서 썸네일 추가)
- [ ] 콘텐츠에 댓글 달기 (Comment 엔티티 활성화)
- [ ] Collection/폴더 기능 (콘텐츠 묶기)
- [ ] 팀 알림: 새 콘텐츠 저장 시 이메일 알림 (Resend)
- [ ] 콘텐츠 공개/비공개 설정 (팀 내에서 내 것만 보기)
- [ ] 브라우저 확장 프로그램 (Chrome/Edge) — 데스크톱 원클릭 저장
- [ ] 콘텐츠 고정(is_pinned) — 팀 피드 상단 고정

### 보안 필수 항목 (Phase 2 추가)
- [ ] AI 엔드포인트에 더 엄격한 rate limit 적용 (OpenAI API 비용 폭발 방지)
- [ ] 브라우저 확장 — 최소 권한 원칙: activeTab만 요청, 모든 사이트 접근 금지
- [ ] 이메일 알림 — 팀원 이메일 외부 서비스(Resend) 전달 시 최소 정보만 포함
- [ ] pgvector embedding 생성 시 콘텐츠 OpenAI 전달 → 팀원에게 고지 필요

### 추가 데이터
- Comment 테이블 활성화
- Item에 `thumbnail_url`, `embedding` 벡터 컬럼 추가 (pgvector)
- Collection 테이블 활성화
- Item.search_vector (tsvector) 활성화

### Phase 2 완료 조건
- [ ] AI 검색으로 "지난달 저장한 것" 같은 자연어 질문이 동작
- [ ] 팀원이 댓글로 소통하는 것이 관찰됨
- [ ] 폴더로 정리하는 팀원이 생김

### Phase 2 시작 프롬프트

```
Phase 1+1.5가 완료된 상태에서 Phase 2를 구현해주세요.
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 2 범위:
- AI 스마트 검색 (pgvector + OpenAI text-embedding-3-small)
- OG 미리보기 썸네일 (microlink.io thumbnail_url)
- 댓글 (Comment 테이블 활성화)
- Collection/폴더 (Collection 테이블 활성화)
- 이메일 알림 (Resend)
- 브라우저 확장 (Chrome/Edge, 최소 권한)
- 콘텐츠 고정 (is_pinned)

반드시 지켜야 할 보안 요구사항:
- AI 엔드포인트 rate limit: 분당 10건/IP (일반보다 3배 엄격)
- 브라우저 확장: activeTab 권한만, 모든 사이트 권한 절대 금지
- embedding 생성 전 콘텐츠 → OpenAI 전달 사실 UI에 표시
- Phase 1+1.5 기능 회귀 테스트 필수
```

---

## Phase 3: 고도화 — AI 자동화

### 전제 조건
- Phase 1 + 2가 안정적으로 운영 중
- 팀당 콘텐츠가 100개 이상 쌓인 상태 (AI 자동화가 의미있는 시점)

### 목표
AI가 알아서 정리해주는 "자동 창고" 수준으로 고도화.

### 기능
- [ ] AI 자동 태그 부여 (저장 시 AI가 태그 3개 자동 제안)
- [ ] AI 자동 콘텐츠 분류 (카테고리 자동 추천)
- [ ] 검색 결과 AI 요약 (관련 항목 묶어서 요약문 생성)
- [ ] 업로드 PDF 자동 요약 (PDF 텍스트 추출 + AI 요약)
- [ ] 태그 기반 필터 고도화 (다중 태그 AND/OR 검색)
- [ ] 소프트 삭제 30일 자동 영구 삭제 배치 (Supabase Edge Function)

### 보안 필수 항목 (Phase 3 추가)
- [ ] AI 자동 태그/요약 비용 모니터링 + 팀당 월 AI 호출 한도 설정
- [ ] PDF 텍스트 추출 시 민감 정보 포함 가능성 → 팀원 고지 필요
- [ ] 영구 삭제 배치: 파일(Storage) + DB 레코드 동시 삭제 원자성 보장

### Phase 3 시작 프롬프트

```
Phase 1+1.5+2가 완료된 상태에서 Phase 3을 구현해주세요.
@PRD/02_DATA_MODEL.md
@PRD/04_PROJECT_SPEC.md

Phase 3 범위:
- AI 자동 태그 (저장 시 GPT-4o-mini로 태그 3개 제안, ItemTag.is_auto = true)
- AI 자동 분류 (카테고리 추천)
- 검색 결과 AI 요약
- PDF 자동 요약 (업로드 PDF → 텍스트 추출 → GPT-4o-mini 요약)
- 다중 태그 AND/OR 검색
- 소프트 삭제 30일 배치 (Supabase Edge Function, Storage 파일도 함께 삭제)

반드시 지켜야 할 보안 요구사항:
- AI 호출 엔드포인트 rate limit 엄격 적용
- 팀당 월 AI 토큰 사용량 모니터링
- PDF → OpenAI 전달 사실 UI에 표시
- 영구 삭제 배치: DB + Storage 원자적 삭제
- AI 오분류 시 팀원이 수동 수정 가능하도록 UX 설계
```

---

## Phase 로드맵 요약

| Phase | 핵심 기능 | 진입 조건 | 상태 |
|-------|----------|-----------|------|
| Phase 1 (MVP) | 링크+노트 + 팀 공유 + 검색(태그 포함) + 인증 + PWA + Rate Limit | — | 시작 전 |
| Phase 1.5 | 파일 업로드 + AI 대화 저장 | Phase 1 완료 조건 달성 | 대기 |
| Phase 2 | AI 스마트 검색 + 댓글 + 컬렉션 + 미리보기 + 알림 + 브라우저 확장 | 콘텐츠 30개+ | 대기 |
| Phase 3 | AI 자동 태그 + 분류 + PDF 요약 + 검색 요약 + 배치 삭제 | 콘텐츠 100개+ | 대기 |
