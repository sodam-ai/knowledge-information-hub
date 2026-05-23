#!/usr/bin/env node
// 자동 백업 (start.bat/start.sh 시작 시 호출)
// - 일 1회 멱등 (같은 날짜 백업 있으면 skip)
// - 30일 이상 된 백업 자동 정리
// - SQLite WAL-safe (better-sqlite3 backup() API 사용)

import Database from "better-sqlite3";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const DATA_DIR = process.env.KIH_DATA_DIR || join(PROJECT_ROOT, "data");
const BACKUP_DIR = join(DATA_DIR, "backups");
const DB_PATH = join(DATA_DIR, "kih.db");
const KEEP_DAYS = 30;

async function main() {
  if (!existsSync(DB_PATH)) {
    // 첫 실행 — DB 없음, 백업 대상 없음
    process.exit(0);
  }

  mkdirSync(BACKUP_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const backupPath = join(BACKUP_DIR, `kih-${today}.db`);

  if (!existsSync(backupPath)) {
    const db = new Database(DB_PATH, { readonly: true });
    try {
      await db.backup(backupPath);
      console.log(`  [backup] ✅ ${backupPath}`);
    } finally {
      db.close();
    }
  }

  // 오래된 백업 정리
  const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000;
  let cleaned = 0;
  for (const f of readdirSync(BACKUP_DIR)) {
    if (!f.startsWith("kih-") || !f.endsWith(".db")) continue;
    const p = join(BACKUP_DIR, f);
    if (statSync(p).mtimeMs < cutoff) {
      unlinkSync(p);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`  [backup] 🗑️ 오래된 백업 ${cleaned}개 정리`);
  }
}

main().catch((err) => {
  // 백업 실패는 앱 실행을 막지 않음 — stderr만 출력 후 정상 종료
  console.error(`  [backup] ⚠️ ${err.message ?? err}`);
  process.exit(0);
});
