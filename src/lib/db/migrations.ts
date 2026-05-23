import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type Database from "better-sqlite3";

const MIGRATIONS_DIR = join(process.cwd(), "db", "migrations");

interface MigrationRow {
  filename: string;
}

/**
 * 마이그레이션 러너 (멱등성 보장)
 * - `_migrations` 테이블로 적용 이력 추적
 * - `db/migrations/*.sql` 디렉토리를 번호순 정렬해 트랜잭션으로 실행
 * - 이미 적용된 파일은 건너뜀
 */
export function runMigrations(db: Database.Database): void {
  if (!existsSync(MIGRATIONS_DIR)) {
    throw new Error(`마이그레이션 디렉토리가 없습니다: ${MIGRATIONS_DIR}`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const appliedRows = db.prepare<[], MigrationRow>("SELECT filename FROM _migrations").all();
  const applied = new Set(appliedRows.map((r: MigrationRow) => r.filename));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const insertMigration = db.prepare("INSERT INTO _migrations (filename) VALUES (?)");

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");

    const apply = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file);
    });

    try {
      apply();
      // eslint-disable-next-line no-console
      console.log(`[migrations] applied: ${file}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`마이그레이션 실패 (${file}): ${msg}`);
    }
  }
}
