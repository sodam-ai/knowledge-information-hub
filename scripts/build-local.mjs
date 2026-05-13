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
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STANDALONE = join(ROOT, ".next", "standalone");

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
  join(ROOT, ".next", "static"),
  join(STANDALONE, ".next", "static"),
  { recursive: true }
);

console.log("▶ db/migrations 복사");
const migDest = join(STANDALONE, "db", "migrations");
mkdirSync(migDest, { recursive: true });
cpSync(join(ROOT, "db", "migrations"), migDest, { recursive: true });

// better-sqlite3 네이티브 바이너리 보강 (Next standalone이 가끔 누락)
const bsqliteDest = join(STANDALONE, "node_modules", "better-sqlite3");
if (!existsSync(join(bsqliteDest, "build"))) {
  console.log("▶ better-sqlite3 네이티브 바이너리 보강");
  cpSync(
    join(ROOT, "node_modules", "better-sqlite3"),
    bsqliteDest,
    { recursive: true }
  );
}

// 시작 스크립트 복사
console.log("▶ start 스크립트 복사");
cpSync(join(ROOT, "scripts", "start.bat"), join(STANDALONE, "start.bat"));
cpSync(join(ROOT, "scripts", "start.sh"), join(STANDALONE, "start.sh"));

// 백업 스크립트 복사 (start.bat/start.sh가 시작 시 호출)
console.log("▶ backup 스크립트 복사");
mkdirSync(join(STANDALONE, "scripts"), { recursive: true });
cpSync(join(ROOT, "scripts", "backup.mjs"), join(STANDALONE, "scripts", "backup.mjs"));

// data/ 폴더는 있으면 그대로 유지, 없으면 빈 폴더만
const dataDest = join(STANDALONE, "data");
if (!existsSync(dataDest)) {
  mkdirSync(dataDest, { recursive: true });
}

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
