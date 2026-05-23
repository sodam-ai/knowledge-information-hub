#!/usr/bin/env node
// 로컬 standalone 빌드 — next build 후 산출물 정리
//
// 사용법:
//   npm run build:local
//
// 결과:
//   .next/standalone/   ← 사용자에게 배포할 폴더 (압축해서 어디든 풀고 실행)

import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STANDALONE = join(ROOT, ".next-build", "standalone");

console.log("▶ next build");
execSync("npm run build", { stdio: "inherit", cwd: ROOT });

if (!existsSync(STANDALONE)) {
  console.error(
    "❌ .next/standalone 폴더가 없습니다. next.config.ts의 output: 'standalone' 확인."
  );
  process.exit(1);
}

console.log("▶ public/ 복사");
cpSync(join(ROOT, "public"), join(STANDALONE, "public"), { recursive: true });

console.log("▶ .next/static 복사");
cpSync(
  join(ROOT, ".next-build", "static"),
  join(STANDALONE, ".next-build", "static"),
  { recursive: true }
);

console.log("▶ db/migrations 복사");
const migDest = join(STANDALONE, "db", "migrations");
mkdirSync(migDest, { recursive: true });
cpSync(join(ROOT, "db", "migrations"), migDest, { recursive: true });

// better-sqlite3 네이티브 바이너리 동기화 (Electron-rebuilt ABI 반드시 덮어쓰기)
const bsqliteDest = join(STANDALONE, "node_modules", "better-sqlite3");
console.log("▶ better-sqlite3 네이티브 바이너리 동기화");
cpSync(
  join(ROOT, "node_modules", "better-sqlite3"),
  bsqliteDest,
  { recursive: true, force: true }
);

// start.bat/start.sh는 Electron 전용 패키징에서 제외 — 외부 브라우저 자동 열기 차단
// (사용자가 .exe 외에 standalone 직접 실행 경로를 클릭할 가능성 영구 제거)

// 백업 스크립트 복사 (start.bat/start.sh가 시작 시 호출)
console.log("▶ backup 스크립트 복사");
mkdirSync(join(STANDALONE, "scripts"), { recursive: true });
cpSync(join(ROOT, "scripts", "backup.mjs"), join(STANDALONE, "scripts", "backup.mjs"));

// data/ 폴더는 항상 빈 폴더로 초기화 — kih.db·supabase-snapshot.json 등 개인정보가 번들에 포함되는 것을 방지
const dataDest = join(STANDALONE, "data");
rmSync(dataDest, { recursive: true, force: true });
mkdirSync(dataDest, { recursive: true });

// 사용 안내 문서
const localDoc = join(ROOT, "LOCAL.md");
if (existsSync(localDoc)) {
  cpSync(localDoc, join(STANDALONE, "LOCAL.md"));
}

// 총 크기 계산
function dirSize(d) {
  let s = 0;
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const st = statSync(p);
    if (st.isDirectory()) s += dirSize(p);
    else s += st.size;
  }
  return s;
}
const mb = (dirSize(STANDALONE) / 1024 / 1024).toFixed(1);

console.log("");
console.log(`✅ standalone 빌드 완료: ${STANDALONE}`);
console.log(`   크기: ${mb} MB`);
console.log("");
console.log("실행:");
console.log(`  Windows:    cd "${STANDALONE}" && start.bat`);
console.log(`  Mac/Linux:  cd "${STANDALONE}" && ./start.sh`);
