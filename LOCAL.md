# Knowledge Information Hub — 로컬 실행 안내

> 인터넷 없이 내 컴퓨터에서만 동작하는 지식 창고.
> 데이터는 모두 같은 폴더 안에 보관됩니다. 폴더만 백업하면 끝.

---

## 한 번만 — 빌드하기 (개발자가)

```bash
git checkout local-only
npm install
npm run migrate:from-supabase    # (선택) Supabase 데이터를 로컬로 가져오기
npm run build:local              # standalone 폴더 생성
```

결과물: `.next/standalone/` (이 폴더가 사용자에게 배포할 전부)

---

## 사용하기 (비개발자)

### Windows
1. 배포받은 폴더의 압축을 풉니다
2. 폴더 안의 `start.bat` 파일을 더블클릭
3. 브라우저가 자동으로 열림 → 비밀번호 `1234` 입력 → 끝

### macOS / Linux
```bash
cd 풀어둔폴더
chmod +x start.sh
./start.sh
```

### 종료
- Windows: 검은 창에서 `Ctrl+C`
- Mac/Linux: 터미널에서 `Ctrl+C`

---

## 비밀번호 바꾸기

1. 브라우저에서 `http://127.0.0.1:3000/admin` 열기
2. 관리자 비밀번호(`admin1234`) 입력 후 변경

> 처음 한 번은 반드시 변경하세요.

---

## 데이터 위치

폴더 안의 `data/kih.db` 파일이 전부.
- **백업**: `data` 폴더를 다른 곳에 복사
- **이동**: 폴더 전체를 다른 컴퓨터에 옮기고 그쪽에서 `start.bat` (Node.js 설치 필요)

---

## 필요 사항

- Node.js 18 이상 ([nodejs.org](https://nodejs.org) LTS)
- 그 외 인터넷 연결, 클라우드 계정 등은 **불필요**

---

## 자주 묻는 질문

**Q. 비밀번호를 잊어버렸어요**
→ `data/kih.db` 파일을 삭제 후 다시 실행 (모든 데이터도 함께 사라짐).
→ 또는 standalone 폴더의 `start.bat`/`start.sh`을 텍스트 편집기로 열어 `VIEW_PASSWORD` 값 확인.

**Q. 포트 3000이 이미 쓰고 있어요**
→ `start.bat` (또는 `start.sh`)을 편집해서 `set "PORT=3001"` 같이 변경.

**Q. 다른 컴퓨터에서도 보고 싶어요 (같은 와이파이)**
→ `start.bat` 안의 `HOSTNAME=127.0.0.1` 을 `0.0.0.0`으로 변경. 폰 브라우저에서 `http://[내PC주소]:3000` 접속.
→ ⚠️ 비밀번호를 반드시 8자리 이상으로 변경하세요.

---

License: MIT — SoDam AI Studio
