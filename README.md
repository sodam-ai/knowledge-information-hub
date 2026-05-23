# Knowledge Information Hub (KIH)

> 내 컴퓨터에서만 동작하는 **1인용 지식 창고 데스크톱 앱**  
> 가입 없음 · 로그인 없음 · 완전 로컬 · 인터넷 없이도 동작

[English →](./README.en.md) | [자세한 사용 가이드 →](./LOCAL.md)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| 링크·노트 저장 | URL 자동 제목·썸네일 추출, 텍스트 메모 |
| 태그·카테고리 | 자동 분류 12종, 최대 10개 태그, 사이드바 필터 |
| 전체 검색 | 한국어 1글자부터 FTS5 전문 검색, 태그 검색 보강 |
| 즉시 반영 | 저장 직후 피드 즉시 업데이트 (낙관적 업데이트) |
| 휴지통 | 소프트 삭제, 복원, 영구 삭제 |
| 자동 백업 | 매일 DB 자동 백업, 30일 보관 |
| 완전 로컬 | SQLite 단일 파일 — Supabase·Vercel·Redis 불필요 |

---

## 설치 방법

### 일반 사용자 — 설치 마법사

개발자가 빌드해서 전달한 설치 파일을 받은 경우:

1. `KIH-Setup-x.x.x-x64.exe` 더블클릭
2. "Windows의 PC 보호" 화면 → **추가 정보 → 실행** 클릭 (코드 서명 미적용, 1회만)
3. 설치 마법사에서 "다음 → 다음 → 설치"
4. 시작 메뉴 또는 바탕화면 **Knowledge Information Hub** 실행 → 바로 피드 화면 진입

> 자세한 사용 안내: [LOCAL.md](./LOCAL.md)

---

## 데이터 위치

```
%APPDATA%\knowledge-information-hub\
├── data/
│   ├── kih.db        ← 모든 데이터 (SQLite 단일 파일)
│   └── backups/      ← 자동 백업 (30일 보관)
├── session.secret    ← 세션 서명 키 (자동 생성)
└── kih-server.log    ← 서버 로그
```

**백업**: 위 폴더 전체를 외장하드·USB에 복사.  
**PC 이전**: 새 PC에 앱 설치 후 위 폴더를 같은 위치에 덮어쓰기.

---

## 개발자용 빌드 안내

### 환경 요구사항

- Node.js 22 LTS · Windows 10/11
- 여유 디스크 7 GB 이상

### Windows 설치 파일 빌드

```powershell
npm install
npm run dist:win
```

산출물:

```
dist-electron/
├── KIH-Setup-x.x.x-x64.exe           ← 배포용 설치 마법사
└── win-unpacked/
    └── Knowledge Information Hub.exe  ← 압축 해제 직접 실행
```

### 개발 서버

```powershell
npm run dev     # http://localhost:3737
```

---

## 폴더 구조

```
knowledge-information-hub/
├── electron/
│   ├── main.cjs            # Electron 메인 프로세스 (Next.js 내장 실행)
│   └── assets/             # 아이콘 리소스
├── src/
│   ├── actions/            # Server Actions (CRUD)
│   ├── app/
│   │   ├── (dashboard)/    # 대시보드 · 탐색 · 휴지통
│   │   ├── api/og/         # OG 메타 추출 API (SSRF 방어 적용)
│   │   ├── onboarding/     # 최초 실행 초기화 화면
│   │   └── share/          # 링크 공유 페이지
│   ├── components/
│   │   ├── items/          # ItemCard · ItemFeed · DashboardFeed · SaveItemButton
│   │   ├── layout/         # TeamHeader
│   │   └── ui/             # Toast 시스템
│   └── lib/
│       ├── db/sqlite.ts    # better-sqlite3 싱글톤
│       ├── security/       # SSRF 방어 · 입력 검증
│       └── validations/    # Zod 스키마
├── db/
│   └── migrations/         # SQLite 마이그레이션 (001~)
├── scripts/
│   ├── build-local.mjs     # standalone 빌드 스크립트
│   └── backup.mjs          # 자동 백업 스크립트
├── electron-builder.yml    # Electron 패키징 설정
├── LOCAL.md                # 사용자 안내 (한국어)
├── LOCAL.en.md             # 사용자 안내 (English)
└── package.json
```

---

## 자주 묻는 질문

**Q. 앱이 떴는데 빈 화면이에요**  
→ 작업 관리자에서 "Knowledge Information Hub" 모두 종료 후 재실행. 그래도 안 되면 `%APPDATA%\knowledge-information-hub\kih-server.log` 확인.

**Q. 데이터는 어디에 있나요?**  
→ `%APPDATA%\knowledge-information-hub\data\kih.db` (Windows: `Win+R` → `%APPDATA%` 입력)

**Q. 인터넷 없어도 되나요?**  
→ ✅ 완전 로컬. 단, 링크 저장 시 제목·썸네일 자동 추출은 인터넷 필요. 인터넷 없으면 URL 그대로 저장됨.

**Q. 다른 PC와 동기화 가능한가요?**  
→ ❌ 단일 사용자 전용. 수동 백업·이동만 가능.

---

## License

MIT License — Copyright (c) 2026 SoDam AI Studio

See [LICENSE](./LICENSE) for details.
