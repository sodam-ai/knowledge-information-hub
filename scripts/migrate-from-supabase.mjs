#!/usr/bin/env node
// 일회성 Supabase → SQLite 마이그레이션 스크립트
//
// 사용법:
//   node --env-file=.env.local scripts/migrate-from-supabase.mjs export
//   node scripts/migrate-from-supabase.mjs import
//
// export: Supabase 원격 DB에서 8개 테이블을 JSON snapshot으로 dump
// import: snapshot.json을 읽어 로컬 SQLite(data/kih.db)에 INSERT

import { writeFileSync, readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const SNAPSHOT_PATH = join(PROJECT_ROOT, "data", "supabase-snapshot.json");
const DB_PATH = join(PROJECT_ROOT, "data", "kih.db");
const MIGRATIONS_DIR = join(PROJECT_ROOT, "db", "migrations");

// 외래키 의존 순서 — 부모 테이블 먼저
const TABLES = [
  "teams",
  "users",
  "user_teams",
  "collections",
  "tags",
  "items",
  "item_tags",
  "site_config",
];

// ───────────────────────────────────────────────────────────
// EXPORT — Supabase → JSON
// ───────────────────────────────────────────────────────────
async function runExport() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !KEY) {
    console.error("❌ 환경변수가 필요합니다: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    console.error("   실행: node --env-file=.env.local scripts/migrate-from-supabase.mjs export");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

  const snapshot = {
    version: "1",
    exported_at: new Date().toISOString(),
    source_url: URL,
    tables: {},
  };

  let totalRows = 0;
  const missing = [];

  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) {
      console.warn(`⚠️  ${t}: ${error.message} (테이블 없거나 권한 부족 — 빈 배열로 기록)`);
      snapshot.tables[t] = [];
      missing.push(t);
    } else {
      snapshot.tables[t] = data ?? [];
      totalRows += (data ?? []).length;
      console.log(`✓ ${t}: ${(data ?? []).length}건`);
    }
  }

  mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), "utf-8");

  console.log("");
  console.log(`✅ 저장 완료: ${SNAPSHOT_PATH}`);
  console.log(`   총 ${totalRows}건 / 테이블 ${TABLES.length}개`);
  if (missing.length > 0) {
    console.log(`   ⚠️  접근 실패 테이블: ${missing.join(", ")}`);
  }
}

// ───────────────────────────────────────────────────────────
// IMPORT — JSON → SQLite
// ───────────────────────────────────────────────────────────
async function runImport() {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.error(`❌ snapshot 파일이 없습니다: ${SNAPSHOT_PATH}`);
    console.error("   먼저 export 단계를 실행하세요.");
    process.exit(1);
  }

  const Database = (await import("better-sqlite3")).default;
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));

  console.log(`▶ DB 파일: ${DB_PATH}`);
  if (existsSync(DB_PATH)) {
    console.log("   (기존 파일에 INSERT OR REPLACE — 중복 PK는 덮어씀)");
  }

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = OFF"); // import 동안만 OFF (순환 의존 안전)
  db.pragma("journal_mode = WAL");

  // 마이그레이션 실행
  const migFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  console.log(`\n▶ 마이그레이션 (${migFiles.length}개):`);
  for (const f of migFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf-8");
    try {
      db.exec(sql);
      console.log(`✓ ${f}`);
    } catch (err) {
      console.error(`❌ 마이그레이션 실패: ${f}\n${err.message}`);
      db.close();
      process.exit(1);
    }
  }

  // 데이터 INSERT
  console.log("\n▶ 데이터 INSERT:");
  let total = 0;
  for (const t of TABLES) {
    const rows = snapshot.tables[t] ?? [];
    if (rows.length === 0) {
      console.log(`- ${t}: 0건 (건너뜀)`);
      continue;
    }

    // SQLite 스키마의 실제 컬럼 목록과 교집합만 INSERT (방어적)
    const sqliteCols = new Set(
      db.prepare(`SELECT name FROM pragma_table_info(?)`).all(t).map((r) => r.name)
    );
    const snapshotCols = Object.keys(rows[0]);
    const validCols = snapshotCols.filter((c) => sqliteCols.has(c));
    const skippedCols = snapshotCols.filter((c) => !sqliteCols.has(c));

    if (validCols.length === 0) {
      console.warn(`⚠️  ${t}: SQLite 스키마에 일치하는 컬럼 0개 (건너뜀)`);
      continue;
    }

    const placeholders = validCols.map(() => "?").join(", ");
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO ${t} (${validCols.join(", ")}) VALUES (${placeholders})`
    );

    const insertAll = db.transaction((records) => {
      for (const r of records) {
        const values = validCols.map((c) => coerceValue(r[c]));
        stmt.run(...values);
      }
    });

    try {
      insertAll(rows);
      const note = skippedCols.length > 0 ? ` [skipped: ${skippedCols.join(",")}]` : "";
      console.log(`✓ ${t}: ${rows.length}건${note}`);
      total += rows.length;
    } catch (err) {
      console.error(`❌ ${t} INSERT 실패: ${err.message}`);
      db.close();
      process.exit(1);
    }
  }

  db.pragma("foreign_keys = ON");

  // 검증
  console.log("\n📊 검증 (SQLite 카운트):");
  let verifyTotal = 0;
  for (const t of TABLES) {
    const row = db.prepare(`SELECT count(*) AS c FROM ${t}`).get();
    const snap = snapshot.tables[t]?.length ?? 0;
    const ok = row.c === snap ? "✓" : "⚠️";
    console.log(`   ${ok} ${t}: ${row.c}건 (snapshot ${snap}건)`);
    verifyTotal += row.c;
  }

  // FTS5 동기화 확인
  try {
    const fts = db.prepare(`SELECT count(*) AS c FROM items_fts`).get();
    const items = db.prepare(`SELECT count(*) AS c FROM items`).get();
    console.log(`   ${fts.c === items.c ? "✓" : "⚠️"} items_fts: ${fts.c}건 (items ${items.c}건)`);
  } catch {
    console.log(`   ⚠️ items_fts 테이블 확인 실패 (FTS5 미적용 가능)`);
  }

  db.close();
  console.log(`\n✅ import 완료: 총 ${verifyTotal}건`);
  console.log(`   DB: ${DB_PATH}`);
}

function coerceValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

// ───────────────────────────────────────────────────────────
// 진입점
// ───────────────────────────────────────────────────────────
const cmd = process.argv[2];
if (cmd === "export") {
  await runExport();
} else if (cmd === "import") {
  await runImport();
} else {
  console.error("사용법:");
  console.error("  node --env-file=.env.local scripts/migrate-from-supabase.mjs export");
  console.error("  node scripts/migrate-from-supabase.mjs import");
  process.exit(1);
}
