-- Knowledge Information Hub — SQLite 통합 스키마
-- Postgres 마이그레이션 001~011을 SQLite 호환 문법으로 압축
--
-- 변환 규칙:
--   UUID            -> TEXT (소문자 hex)
--   TIMESTAMPTZ     -> TEXT (ISO 8601, 예 '2026-05-14T02:30:00.000Z')
--   BOOLEAN         -> INTEGER (0/1)
--   VARCHAR(n)      -> TEXT (SQLite 무제한)
--   gen_random_uuid -> 애플리케이션에서 생성 (lower(hex(randomblob(16))) 보조)
--   RLS / SECURITY DEFINER / pg_trgm / tsvector -> 제거 (단일 사용자, FTS5로 대체)

PRAGMA foreign_keys = ON;

-- ==============================
-- TABLES
-- ==============================

-- 팀 (워크스페이스)
CREATE TABLE IF NOT EXISTS teams (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  invite_code       TEXT NOT NULL UNIQUE,
  invite_expires_at TEXT NOT NULL,
  is_public         INTEGER NOT NULL DEFAULT 0,
  description       TEXT,
  category          TEXT CHECK (
    category IS NULL OR category IN
    ('ai','dev','design','marketing','study','business','investment','etc')
  ),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 사용자
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL,
  name           TEXT NOT NULL,
  avatar_url     TEXT,
  username       TEXT,
  is_anonymized  INTEGER NOT NULL DEFAULT 0,
  anonymized_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users (username) WHERE username IS NOT NULL;

-- 사용자-팀 (현재 미사용, 호환을 위해 유지)
CREATE TABLE IF NOT EXISTS user_teams (
  user_id     TEXT NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  team_id     TEXT NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('admin','member')),
  joined_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  invited_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  left_at     TEXT,
  PRIMARY KEY (user_id, team_id)
);

-- 컬렉션
CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  team_id     TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (name, team_id)
);

-- 태그
CREATE TABLE IF NOT EXISTS tags (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  color    TEXT,
  team_id  TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE (name, team_id)
);

-- 콘텐츠 아이템
CREATE TABLE IF NOT EXISTS items (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('link','note','file','ai_chat')),
  title           TEXT NOT NULL,
  content         TEXT,
  url             TEXT,
  url_hash        TEXT,
  file_path       TEXT,
  file_mime       TEXT,
  thumbnail_url   TEXT,
  collection_id   TEXT REFERENCES collections(id) ON DELETE SET NULL,
  category        TEXT,
  is_pinned       INTEGER NOT NULL DEFAULT 0,
  view_count      INTEGER NOT NULL DEFAULT 0,
  team_id         TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  is_deleted      INTEGER NOT NULL DEFAULT 0,
  deleted_at      TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- 아이템-태그
CREATE TABLE IF NOT EXISTS item_tags (
  item_id  TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id   TEXT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  is_auto  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, tag_id)
);

-- 사이트 설정 (비밀번호 해시 저장소)
CREATE TABLE IF NOT EXISTS site_config (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ==============================
-- INDEXES
-- ==============================
CREATE INDEX IF NOT EXISTS idx_items_team_id     ON items (team_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at  ON items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_is_deleted  ON items (is_deleted);
CREATE INDEX IF NOT EXISTS idx_items_category    ON items (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_pinned      ON items (is_pinned) WHERE is_pinned = 1;
CREATE INDEX IF NOT EXISTS idx_items_collection  ON items (collection_id) WHERE collection_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_teams_team   ON user_teams (team_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user   ON user_teams (user_id);
CREATE INDEX IF NOT EXISTS idx_tags_team_id      ON tags (team_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_item    ON item_tags (item_id);
CREATE INDEX IF NOT EXISTS idx_item_tags_tag     ON item_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_collections_team  ON collections (team_id);
CREATE INDEX IF NOT EXISTS idx_teams_public      ON teams (created_at DESC) WHERE is_public = 1;

-- ==============================
-- TRIGGERS — updated_at 자동 갱신
-- ==============================
CREATE TRIGGER IF NOT EXISTS items_updated_at
AFTER UPDATE OF title, content, url, url_hash, file_path, file_mime,
                thumbnail_url, collection_id, category, is_pinned,
                view_count, is_deleted, deleted_at ON items
FOR EACH ROW
BEGIN
  UPDATE items SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;
