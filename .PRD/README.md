# TeamVault — 디자인 문서

> Show Me The PRD로 생성됨 (2026-04-09) | v3.1 업그레이드 완료

---

## 제품 한 줄 요약

소규모 팀이 링크·노트·파일·AI 대화를 한 곳에 모으고, AI로 빠르게 찾는 팀 지식 창고.

---

## v3.1 주요 변경사항

| 변경 | 내용 |
|------|------|
| 계정 탈퇴 + 데이터 익명화 | Phase 1 필수 요구사항으로 격상. PII 즉시 삭제, 팀 콘텐츠 유지 |
| User 엔티티 필드 추가 | is_anonymized, anonymized_at (탈퇴 익명화 추적) |
| 팀 규모 하드 리밋 | 팀당 최대 20명, 사용자당 최대 5팀 (DB 제약 + 서버 액션) |
| 한국어 검색 강화 | pg_trgm + tsvector 병행, 최소 2자 제한, SQL 인덱스 명시 |
| 성능 SLA 추가 | p95 기준값 명시 + Vercel Analytics 측정 방법 |
| 가져오기/내보내기 | Phase 1.5: 브라우저 북마크 HTML 가져오기 + JSON 내보내기 |
| 계정 탈퇴 흐름 추가 | 01_PRD 사용자 흐름 + Phase 1 체크리스트에 포함 |
| 관리자 승계 정책 추가 | 마지막 admin 탈퇴 차단 + 계정 삭제 시 최고참 member 자동 승격 |
| 외부 서비스 폴백 설계 | microlink.io 3초 타임아웃 → URL을 임시 제목으로 graceful 저장 |
| 리스크 테이블 확장 | PII 장기 보관, 리소스 남용, 한국어 검색 품질 추가 |
| DO NOT 목록 강화 | 팀원 수 제한 우회, 탈퇴 트랜잭션 생략, 부분 익명화 금지, 승계 생략 금지 |
| Phase 1 시작 프롬프트 갱신 | 계정 탈퇴, 팀 리밋, tsvector 검색, Analytics, 관리자 승계, 폴백 포함 |
| Phase 1.5 시작 프롬프트 갱신 | 가져오기/내보내기, magic bytes 검증, signed URL 명시 |

---

## v3.0 주요 변경사항

| 변경 | 내용 |
|------|------|
| 보안 핵심 요구사항화 | 보안을 선택 사항이 아닌 구현 완료 기준으로 격상 |
| 위협 모델 추가 | 10가지 위협 + 4계층 신뢰 경계 설계 명시 |
| Rate Limiting 추가 | Vercel Edge + Upstash Redis, 엔드포인트별 제한값 명시 |
| SSRF 방지 설계 | microlink.io API 위임 방식 명시 (서버 직접 fetch 금지) |
| URL 제목 추출 방식 확정 | microlink.io (Phase 1부터 적용) |
| invite_code 길이 상향 | 12자 → 16자 이상 (브루트포스 방지) |
| 콘텐츠 권한 모델 추가 | 수정=본인, 삭제=본인+admin (RLS 명시) |
| 검색 범위 확장 | 제목+내용 → 제목+내용+**태그** 포함 |
| PWA Phase 1 추가 | manifest.json + Web Share Target API (모바일 공유) |
| 브라우저 확장 Phase 2 추가 | Chrome/Edge 원클릭 저장 |
| url_hash 필드 추가 | Item 테이블 — 링크 중복 감지용 SHA-256 해시 |
| is_pinned / view_count 추가 | Item 테이블 — Phase 2 고정/인기 기능 준비 |
| UserTeam 필드 추가 | invited_by (초대 추적), left_at (탈퇴 기록) |
| Phase 1.5/2/3 시작 프롬프트 추가 | 각 Phase별 AI 시작 프롬프트 완성 |
| NEEDS CLARIFICATION 전부 해소 | 12개 결정 사항 확정 |
| 환경변수 추가 | UPSTASH_REDIS_REST_URL/TOKEN, MICROLINK_API_KEY |
| 샘플 콘텐츠 온보딩 추가 | 팀 생성 직후 샘플 3개 자동 생성 |

---

## v2.0 변경사항 (참고)

| 변경 | 내용 |
|------|------|
| Phase 1 범위 축소 | 4종 → 링크+노트 2종만 MVP |
| UserTeam 구조 도입 | User.team_id 단일 → N:N 중간 테이블 |
| 소프트 삭제 추가 | is_deleted + deleted_at (30일 복구 가능) |
| 초대 코드 만료 추가 | invite_expires_at (72시간 유효) |
| Collection 엔티티 추가 | 폴더 개념 (Phase 2에서 활성화) |
| 파일 MIME 허용 목록 | 악성 파일 업로드 차단 설계 |
| Sentry 에러 모니터링 추가 | 배포 후 오류 즉시 감지 |

---

## 문서 구성

| 문서 | 내용 | 언제 읽나 |
|------|------|----------|
| [01_PRD.md](./01_PRD.md) | 뭘 만드는지, 누가 쓰는지, 기능 목록, 보안 요구사항, 리스크 | 프로젝트 시작 전 필독 |
| [02_DATA_MODEL.md](./02_DATA_MODEL.md) | 데이터 구조 (권한 모델·url_hash·UserTeam 필드 포함) | DB 설계할 때 |
| [03_PHASES.md](./03_PHASES.md) | Phase 1~3 + 완료 조건 + 각 Phase 시작 프롬프트 | 개발 순서 정할 때 |
| [04_PROJECT_SPEC.md](./04_PROJECT_SPEC.md) | 기술 스택, 위협 모델, 보안 설계, Rate Limiting, AI 행동 규칙 | AI에게 코드 시킬 때마다 |

---

## 다음 단계

Phase 1을 시작하려면 **[03_PHASES.md](./03_PHASES.md)** 의 "Phase 1 시작 프롬프트"를 복사해서 AI에게 붙여넣으세요.

반드시 함께 첨부할 파일:
- `@PRD/01_PRD.md`
- `@PRD/02_DATA_MODEL.md`
- `@PRD/04_PROJECT_SPEC.md`

---

## 기술 스택 요약

| 영역 | 선택 |
|------|------|
| 프론트엔드 | Next.js 15 + Tailwind + Shadcn/UI |
| DB / 인증 / 파일 | Supabase (PostgreSQL + Auth + Storage) |
| URL 추출 | microlink.io API |
| Rate Limiting | Vercel Edge Middleware + Upstash Redis |
| 배포 | Vercel |
| 에러 모니터링 | Sentry |
| AI 검색 (Phase 2~) | Supabase pgvector + OpenAI |

---

## Phase 로드맵

| Phase | 핵심 기능 | 진입 조건 |
|-------|----------|-----------|
| Phase 1 (MVP) | 링크+노트 + 팀 공유 + 검색(태그 포함) + 인증 + PWA + Rate Limit | — |
| Phase 1.5 | 파일 업로드 + AI 대화 저장 | Phase 1 완료 조건 달성 |
| Phase 2 | AI 검색 + 댓글 + 컬렉션 + 알림 + 브라우저 확장 | 콘텐츠 30개+ |
| Phase 3 | AI 자동 태그 + 분류 + PDF 요약 + 배치 삭제 | 콘텐츠 100개+ |

---

## 보안 설계 요약 (4계층 방어)

```
[브라우저]  →  [Vercel Edge: Rate Limit]  →  [서버 액션: Auth 검증]  →  [Supabase RLS: 데이터 격리]
```

- **외부 URL**: 서버가 직접 fetch하지 않음 → microlink.io 위임
- **파일 업로드**: MIME 검증 + private 버킷 + signed URL
- **초대 코드**: 16자 이상 + 72시간 만료 + rate limit
- **콘텐츠 권한**: 수정=본인, 삭제=본인+admin

---

## 미결 오픈 이슈

- [ ] microlink.io 무료 티어(1,000건/월) 초과 시 유료 전환 여부?
- [ ] 프로젝트명 "TeamVault" 최종 확정 여부?
- [ ] 커스텀 도메인 사용 여부?
