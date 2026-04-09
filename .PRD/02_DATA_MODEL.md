# TeamVault — 데이터 모델

> 최종 수정: 2026-04-09 v3.1
> 이 문서는 앱에서 다루는 핵심 데이터의 구조를 정의합니다.
> 개발자가 아니어도 이해할 수 있는 "개념적 ERD"입니다.

---

## 전체 구조

```
[Team] --N:N--> [User]          ← UserTeam 중간 테이블로 연결
(팀 공간)       (팀원)            (한 사람이 여러 팀 소속 가능)
                   |
                   | creates
                   v
[Collection] --1:N--> [Item] --N:N--> [Tag]
(폴더/묶음)           (콘텐츠)         (분류 라벨)
(Phase 2~)            |    (via ItemTag)
                       |
                       v 1:N
                   [Comment]       ← Phase 2에서 활성화
                   (댓글)
```

---

## 엔티티 상세

### Team (팀)
팀원들이 함께 사용하는 공용 공간. 팀 하나 = 창고 하나.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 (자동 생성) | uuid-abc | O |
| name | 팀 이름 (최대 50자) | "디자인팀", "AI 스터디" | O |
| invite_code | 초대용 코드 — **최소 16자 이상** 무작위 문자열 | "abc123xyz789qwer" | O |
| invite_expires_at | 초대 코드 만료 시각 (발급 후 72시간) | 2026-04-12T10:00:00Z | O |
| created_at | 팀 만든 날짜 (자동) | 2026-04-09 | O |

> **팀 규모 하드 리밋** (리소스 남용 방지):
> - 팀당 최대 멤버 수: **20명** (타겟 2~10명에 충분한 여유)
> - 사용자당 소속 팀 최대: **5개** (UserTeam 기준)
> - 제한 초과 시 합류/생성 차단 + 명확한 안내 메시지
> - 서버 액션 레벨 + DB CHECK 제약 조건 양쪽에서 적용 권장
> - Rate limiting과 독립적으로 동작 (천천히 쌓는 남용도 차단)

> **보안 설계**: invite_code는 최소 16자 무작위 문자열(12자에서 상향 — 브루트포스 방지).
> 72시간 후 자동 만료. 관리자만 재발급 가능. 합류 시도는 시간당 5건/IP로 제한.
> 합류 성공/실패 이벤트는 서버 로그에 기록.

---

### User (사용자)
TeamVault에 가입한 개별 사용자. 여러 팀에 동시 소속될 수 있습니다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 (Supabase Auth 연동) | uuid-def | O |
| email | 로그인 이메일 (탈퇴 시 익명화) | kim@example.com | O |
| name | 표시 이름 (최대 50자, 탈퇴 시 익명화) | 김지수 | O |
| avatar_url | 프로필 사진 URL (탈퇴 시 null) | https://... | X |
| is_anonymized | 계정 탈퇴 익명화 여부 | false | O |
| anonymized_at | 익명화 처리 시각 (null이면 정상 계정) | 2026-05-01T09:00:00Z | X |
| created_at | 가입일 (자동) | 2026-04-09 | O |

> **계정 탈퇴 설계** (Privacy by Design):
> - 탈퇴 요청 즉시 (원자적 트랜잭션):
>   1. email → `deleted-{uuid}@teamvault.invalid`, name → `[탈퇴한 사용자]`, avatar_url → null
>   2. is_anonymized = true, anonymized_at = now() 기록
>   3. **Item.created_by → NULL** (UUID FK 해제 — 행동 패턴 재식별 방지)
>   4. UserTeam 레코드: left_at = now()
>   5. SHA-256 해시된 원본 이메일을 `DeletedEmails` 테이블에 저장 (재가입 차단용)
>   6. Supabase Auth 계정 삭제 (재로그인 불가)
> - **created_by = NULL 이유**: UUID를 유지하면 이름/이메일이 없어도 "이 UUID가 만든 모든 콘텐츠"를 열거해 행동 패턴 재식별 가능 — 완전한 PII 보호를 위해 연결 해제 필수
> - **재가입 차단 이유**: 동일 이메일로 재가입 시 초대 흐름·SSO 조회에서 이전 계정과 연결될 위험 차단

---

### UserTeam (사용자-팀 연결)
User와 Team을 연결하는 중간 테이블. 한 사람이 여러 팀에 소속 가능.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| user_id | 사용자 ID | uuid-def | O |
| team_id | 팀 ID | uuid-abc | O |
| role | 역할 (admin / member) | member | O |
| joined_at | 팀 합류일 (자동) | 2026-04-09 | O |
| invited_by | 초대한 사람의 user_id (감사 추적용) | uuid-xyz | X |
| left_at | 팀 탈퇴일 (null이면 현재 소속) | 2026-05-01T09:00:00Z | X |

> **권한 모델**: admin은 팀 설정 변경, 초대 코드 재발급, 타인 콘텐츠 소프트 삭제 가능.
> member는 본인 콘텐츠만 수정/삭제 가능.
> `invited_by` 필드는 초대 경로 추적과 보안 감사에 활용.

> **관리자 승계 정책**:
> - 마지막 admin은 팀에서 자발적으로 나갈 수 없음 (서버 액션 레벨 차단).
> - 계정 삭제로 마지막 admin이 사라질 경우: `joined_at`이 가장 이른 member를 자동으로 admin 승격.
> - 남은 member가 없으면 팀을 비활성 상태로 처리 (데이터는 보존).
> - 승계 이벤트는 감사 로그에 기록.

---

### Collection (컬렉션/폴더) — Phase 2에서 활성화
콘텐츠를 묶는 폴더. 콘텐츠가 50개 넘어가면 필요해집니다.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid-col | O |
| name | 폴더 이름 (최대 100자) | "마케팅 리서치", "주간 아티클" | O |
| team_id | 어느 팀의 폴더인지 | uuid-abc | O |
| created_by | 만든 사람 | uuid-def | O |
| created_at | 만든 날짜 (자동) | 2026-04-09 | O |

> Phase 1에서는 Collection 없이 전체 팀 피드로 운영. Phase 2에서 활성화.

---

### Item (콘텐츠 아이템)
팀원이 저장하는 모든 콘텐츠. 링크·노트·파일·AI 대화를 하나의 테이블로 통합 관리.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 (자동 생성) | uuid-ghi | O |
| type | 콘텐츠 유형 | link / note / file / ai_chat | O |
| title | 제목 (최대 500자, 자동 추출 또는 직접 입력) | "Claude 프롬프트 가이드" | O |
| content | 본문 / 메모 내용 (최대 50,000자) | "요약: ..." | X |
| url | 링크 타입일 때 원본 URL | https://... | type=link 시 O |
| url_hash | URL의 SHA-256 해시 (정규화 후) — 중복 감지용 | "sha256:abc..." | type=link 시 O |
| file_path | 파일 타입일 때 저장 경로 (Supabase Storage) | /files/report.pdf | type=file 시 O |
| file_mime | 파일 MIME 타입 (허용 목록 검증용) | application/pdf | type=file 시 O |
| thumbnail_url | 링크 미리보기 썸네일 (Phase 2, microlink.io에서 추출) | https://... | X |
| collection_id | 소속 컬렉션 (Phase 2, 없으면 null) | uuid-col 또는 null | X |
| is_pinned | 팀 피드 상단 고정 여부 | false | O |
| view_count | 조회수 (추후 인기 콘텐츠 정렬용) | 0 | O |
| search_vector | 전문 검색용 tsvector (Phase 2에서 활성화) | — | X |
| team_id | 어느 팀의 콘텐츠인지 | uuid-abc | O |
| created_by | 저장한 사람 (User.id, **탈퇴 시 NULL로 설정**) | uuid-def 또는 null | X |
| is_deleted | 소프트 삭제 여부 (휴지통) | false | O |
| deleted_at | 삭제된 시각 (null이면 삭제 안 됨) | 2026-05-01T09:00:00Z | X |
| created_at | 저장일 (자동) | 2026-04-09 | O |
| updated_at | 마지막 수정일 (자동) | 2026-04-09 | O |

**type 값 정의**:
- `link` — URL 북마크 (웹 페이지, 유튜브 등)
- `note` — 텍스트 메모
- `file` — 업로드 파일 (허용 MIME: PDF, 이미지, Office 문서) — Phase 1.5
- `ai_chat` — AI 대화 텍스트 붙여넣기 — Phase 1.5

**url_hash 중복 감지 동작**:
- 링크 저장 시 URL을 정규화(소문자, 트레일링 슬래시 제거, utm 파라미터 제거) 후 SHA-256 해시
- 같은 팀 내 동일 url_hash 존재 시 "이미 저장된 링크입니다 — 그래도 저장할까요?" 토스트 알림
- 강제 차단하지 않음 — 팀원 판단에 맡김

**허용 파일 MIME 목록** (type=file 저장 시 서버에서 검증):
```
application/pdf
image/png, image/jpeg, image/gif, image/webp
application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
text/plain
```

**소프트 삭제 동작**:
- 삭제 시 실제로 DB에서 제거하지 않고 `is_deleted = true`, `deleted_at` 기록
- 30일 후 자동 영구 삭제 (배치 작업 또는 Supabase Edge Function)
- 영구 삭제 시 Supabase Storage의 연결 파일도 함께 삭제
- 삭제된 항목은 일반 조회에서 제외 (`WHERE is_deleted = false` 필터 필수)

**소프트 삭제 보안 설계 원칙**:
- `is_deleted = false` 조건은 **RLS 정책 레벨**에서 적용 권장 (쿼리 레벨 필터는 실수로 누락될 위험 있음)
- RLS에서 `USING (team_id = [user_team_id] AND is_deleted = false)` 형태로 정의하면 모든 조회에서 자동 적용
- 삭제된 콘텐츠 조회는 명시적으로 service role key를 사용하는 배치 작업에서만 허용

**콘텐츠 권한 모델**:
- 수정(UPDATE): `created_by = auth.uid()` 인 경우만
- 소프트 삭제: `created_by = auth.uid()` 또는 UserTeam에서 `role = 'admin'` 인 경우
- 조회(SELECT): 같은 팀원 전체 (`team_id` 기준 RLS)

---

### Tag (태그)
콘텐츠 분류용 라벨. 수동으로 붙이거나 AI가 자동 제안 (Phase 3).

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid-jkl | O |
| name | 태그 이름 (최대 30자) | "AI", "디자인", "참고자료" | O |
| color | 표시 색상 (HEX) | "#3B82F6" | X |
| team_id | 어느 팀의 태그인지 | uuid-abc | O |

---

### ItemTag (아이템-태그 연결)
아이템과 태그를 연결하는 중간 테이블.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| item_id | 연결된 아이템 | uuid-ghi | O |
| tag_id | 연결된 태그 | uuid-jkl | O |
| is_auto | AI 자동 태그 여부 (Phase 3) | false | O |

---

### DeletedEmails (탈퇴 이메일 차단 목록)
재가입을 통한 이전 계정 연결 위험을 차단하는 보안 테이블.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid-del | O |
| email_hash | 원본 이메일의 SHA-256 해시 (이메일 원문 저장 안 함) | "sha256:abc..." | O |
| deleted_at | 탈퇴 처리 시각 | 2026-05-01T09:00:00Z | O |
| blocked_until | 재가입 차단 만료 시각 (삭제_시각 + 90일) | 2026-07-30T09:00:00Z | O |

> **설계 원칙**: 원본 이메일을 저장하지 않음 — SHA-256 해시만 저장. 재가입 시 동일 해시가 존재하면 차단.
> 90일 후 이 레코드도 삭제 (불필요한 데이터 최소 보관 원칙).
> 감사 이벤트 로그에도 원본 이메일을 절대 기록하지 않음.

---

### Comment (댓글) — Phase 2에서 활성화
팀원이 저장된 콘텐츠에 다는 의견.

| 필드 | 설명 | 예시 | 필수 |
|------|------|------|------|
| id | 고유 식별자 | uuid-mno | O |
| content | 댓글 내용 (최대 2,000자) | "이거 정말 유용하네요!" | O |
| item_id | 어느 아이템에 달린 댓글인지 | uuid-ghi | O |
| user_id | 댓글 작성자 | uuid-def | O |
| created_at | 작성일 (자동) | 2026-04-09 | O |

---

## 관계 요약

- Team과 User는 N:N 관계 (UserTeam으로 연결) — 한 사람이 여러 팀 소속 가능
- User 1명이 여러 Item을 저장함
- Collection 1개에 여러 Item이 포함됨 (Item.collection_id = null이면 미분류)
- Item 1개에 여러 Tag가 붙을 수 있음 (N:N → ItemTag로 연결)
- Item 1개에 여러 Comment가 달릴 수 있음
- 삭제된 Item은 is_deleted=true로 표시, 30일 후 영구 삭제
- UserTeam.left_at이 null이 아닌 팀원 = 탈퇴한 팀원 (그가 남긴 Item은 유지)

---

## 왜 이 구조인가

**Item 테이블 통합 설계 (type 필드 방식)**:
링크·노트·파일·AI 대화를 각각 별도 테이블로 만들면 검색 쿼리가 4배 복잡해진다.
`type` 컬럼 하나로 구분하면 "팀의 모든 콘텐츠"를 단일 쿼리로 조회 가능.

**url_hash 중복 감지**:
URL 정규화(utm 파라미터 제거 등) 후 SHA-256 해시를 저장하면 "같은 링크 두 번 저장"을 경고할 수 있음.
강제 차단이 아닌 경고 방식 → 팀 자율성 보장.

**UserTeam N:N 구조 + invited_by + left_at**:
단일 FK 방식은 다중 팀 소속 불가. N:N으로 처음부터 설계.
`invited_by`는 초대 경로 추적 (보안 감사). `left_at`은 탈퇴 시점 기록 (콘텐츠는 유지).

**소프트 삭제**:
하드 삭제는 팀원 실수 시 복구 불가. is_deleted + deleted_at으로 30일 복구 창 제공.

**is_pinned / view_count**:
Phase 1부터 필드 준비 → Phase 2에서 "인기 콘텐츠 상단 표시" 기능을 스키마 변경 없이 구현 가능.

---

## [NEEDS CLARIFICATION] — 결정 완료

| 항목 | 결정 |
|------|------|
| 파일 크기 제한 | 건당 20MB, 팀 전체 1GB |
| 소프트 삭제 보관 기간 | 30일 후 영구 삭제 |
| 역할 단계 | admin / member 2단계 |
| 다중 팀 소속 | UserTeam N:N 유지 |
| 탈퇴 팀원 콘텐츠 | Item 유지, left_at 기록 |
| invite_code 길이 | 최소 16자 (12자에서 상향) |
| URL 중복 처리 | 경고 토스트 + 강제 차단 안 함 |
