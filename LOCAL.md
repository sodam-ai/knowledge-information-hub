# Knowledge Information Hub — 데스크톱 앱 안내 (한국어)

> 인터넷 없이 내 컴퓨터에서만 동작하는 1인용 지식 창고.
> 데이터는 모두 사용자 폴더에 보관됩니다. 폴더만 백업하면 끝.

🌐 **English version**: [LOCAL.en.md](./LOCAL.en.md)
🌐 **클라우드 모드(팀용)**: [README.md](./README.md)

---

## 누구를 위한 가이드인가?

- 컴퓨터 1대에서 혼자 사용 (가족 공유 가능)
- 인터넷 끊겨도 동작해야 함
- Supabase·Vercel 같은 외부 서비스 의존 안 함
- 가입·로그인·관리자 페이지 등 복잡한 단계 0개

---

## 빠른 시작 (5분)

### 1단계 — 설치 마법사 더블클릭

산출물 위치 (개발자가 빌드해서 전달):
```
dist-electron/KIH-Setup-1.3.2-x64.exe
```

- 더블클릭 → "Windows의 PC 보호" 화면 뜨면 **"추가 정보 → 실행"** 클릭
- (코드 서명을 안 했기 때문에 발생하는 정상 안내. 1회만 클릭하면 됨.)

### 2단계 — 설치 진행

NSIS 마법사가 알아서 설치합니다. 기본값으로 "다음 → 다음 → 설치" 하시면 됩니다.

### 3단계 — 실행

- 시작 메뉴 또는 바탕화면의 **Knowledge Information Hub** 더블클릭
- Electron 창이 열리면서 **곧바로 피드 화면**으로 진입 (비밀번호 입력 단계 없음)

---

## v1.3.2 변경 사항 (2026-05-17)

| 변경 | 영향 |
|---|---|
| ❌ **비밀번호 페이지 삭제** | 첫 화면이 바로 대시보드 |
| ❌ **관리자 페이지(`/admin`) 삭제** | 비밀번호 변경 UI 없음 (단일 사용자라 불필요) |
| ❌ **로그아웃 버튼 삭제** | 헤더 우측 정리 |
| ✅ **🗑️ 휴지통 페이지 신규** | 헤더 우측 휴지통 아이콘 → `/trash` |
| ✅ **휴지통 동작** | 삭제 항목 자동 표시 / 복원 / 영구 삭제 / 모두 비우기 |

---

## 사용 방법

### 항목 저장
1. 대시보드 우측 상단 **+ 추가** 버튼
2. 링크 / 노트 / 파일 중 선택
3. 저장하면 자동으로 제목·썸네일 추출 (링크의 경우)

### 항목 삭제
1. 카드 우측 메뉴 → 삭제
2. 휴지통으로 이동 (영구 삭제 X)

### 휴지통 사용
- 헤더 우측 🗑️ 아이콘 클릭 → 삭제된 항목 목록 자동 표시
- 항목별 버튼:
  - ↩️ **복원** — 대시보드로 되돌리기
  - ✕ **영구 삭제** — 비가역 (확인 대화상자 1회)
- 상단 **모두 비우기** — 휴지통 전체 영구 삭제 (확인 대화상자 1회)

### 검색
- 헤더 검색창 (1글자부터 가능)
- 한국어 어절 검색 지원 (FTS5 unicode61)

---

## 데이터 위치

```
%APPDATA%\knowledge-information-hub\
├── data/
│   ├── kih.db          ← 모든 데이터 (DB 단일 파일)
│   └── backups/        ← 자동 백업 (30일 보관)
├── session.secret      ← 세션 서명 키 (자동 생성)
├── kih-server.log      ← 서버 로그
└── ...
```

**백업 방법**: 위 폴더 전체를 외장하드·USB 등에 복사.

**이동 방법**: 다른 PC에 v1.3.2 새로 설치 → 위 폴더를 같은 위치에 덮어쓰기.

---

## 자주 묻는 질문

**Q. 설치 마법사 클릭해도 아무 일도 안 일어나요**
→ Windows Defender SmartScreen가 차단했을 가능성. 파란 화면이 잠깐 뜨면 "추가 정보 → 실행" 클릭. 안 뜨면 안티바이러스(Avast/Norton 등) 격리 목록 확인.

**Q. 앱이 떴는데 빈 화면이에요**
→ 작업 관리자에서 "Knowledge Information Hub" 모두 종료 후 다시 실행. 그래도 안 되면 `%APPDATA%\knowledge-information-hub\kih-server.log` 파일 확인.

**Q. 데이터 어디 있어요?**
→ `%APPDATA%\knowledge-information-hub\data\kih.db` (Windows 단축키: `Win+R` → `%APPDATA%` 입력)

**Q. 비밀번호 묻는 화면이 다시 나타났어요**
→ 옛 버전(v1.2.x 이하) 설치본일 수 있음. 제어판에서 "Knowledge Information Hub" 제거 후 v1.3.2 새로 설치.

**Q. 인터넷 없어도 되나요?**
→ ✅ 완전 로컬. 단, **링크 저장 시 제목·썸네일 자동 추출은 인터넷 필요**. 인터넷 없으면 URL 그대로 저장됨.

**Q. 다른 PC와 동기화 가능한가요?**
→ ❌ 단일 사용자 모드라 동기화 기능 없음. 수동 백업·이동만 가능.

---

## 개발자용 빌드 안내

> 사용자(비개발자)는 이 섹션 무시. 개발자가 직접 빌드할 때만 참고.

### 환경 요구사항
- Node.js 22 (LTS 권장)
- Windows 10/11 (Electron 빌드는 Windows에서)
- 7GB 이상 디스크 여유 (electron-builder 임시 파일)

### 빌드 명령
```powershell
cd "프로젝트 폴더"
npx @electron/rebuild -f -w better-sqlite3
npm run dist:win
```

산출물:
- `dist-electron/KIH-Setup-1.3.2-x64.exe` (설치 마법사, ~158 MB)
- `dist-electron/win-unpacked/Knowledge Information Hub.exe` (압축 해제 직접 실행)

### 빌드 hang 발생 시
이번 버전은 잠긴 `.next` 폴더 문제를 우회하기 위해 **출력 디렉토리를 `.next-build`로 변경**했습니다.
- `next.config.ts`의 `distDir: ".next-build"` 설정 유지 필수
- 90개 이상 다른 node 프로세스 동시 실행 시 빌드가 멈출 수 있음 → 다른 Next 프로젝트 dev 서버 종료 권장

### 보안 주의
- `.env.local`의 `VIEW_PASSWORD=1234` 등 기본값은 placeholder. 데스크톱 모드에서는 자동 생성된 `session.secret`이 사용됨
- `data/*.db`, `PASSWORDS.md`, `.env*` 모두 `.gitignore` 차단됨

---

## 라이선스

MIT — SoDam AI Studio
