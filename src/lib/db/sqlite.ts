import "server-only";
import Database from "better-sqlite3";
import envPaths from "env-paths";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runMigrations } from "./migrations";

const APP_NAME = "KIH";
const DB_FILENAME = "kih.db";

/**
 * 데이터 폴더 위치 결정 (우선순위)
 *   1. KIH_DATA_DIR 환경변수 (사용자 명시 경로 — 백업/이전용)
 *   2. NODE_ENV !== 'production' -> 프로젝트 루트의 data/
 *   3. 프로덕션 -> OS 표준 데이터 폴더 (env-paths)
 */
function resolveDataDir(): string {
  if (process.env.KIH_DATA_DIR) {
    return process.env.KIH_DATA_DIR;
  }
  if (process.env.NODE_ENV !== "production") {
    return join(process.cwd(), "data");
  }
  return envPaths(APP_NAME, { suffix: "" }).data;
}

let dbInstance: Database.Database | null = null;

/**
 * SQLite 싱글톤. 첫 호출 시 데이터 폴더 생성 + 마이그레이션 실행.
 * server action / route handler에서만 호출 가능 (server-only).
 */
export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = resolveDataDir();
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, DB_FILENAME);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");

  runMigrations(db);

  dbInstance = db;
  return db;
}

/**
 * 프로세스 종료 시 DB 핸들 정리 (선택).
 */
export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * 트랜잭션 헬퍼 — better-sqlite3 동기 API.
 */
export function withTransaction<T>(fn: (db: Database.Database) => T): T {
  const db = getDb();
  const tx = db.transaction(fn);
  return tx(db);
}

/**
 * UUID v4 생성 (Postgres gen_random_uuid 대체).
 * Node 18+의 crypto.randomUUID 사용.
 */
export function newId(): string {
  return crypto.randomUUID();
}
