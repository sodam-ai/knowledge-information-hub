-- FTS5 전문 검색 인덱스
-- Postgres의 pg_trgm + tsvector를 SQLite의 FTS5로 대체
-- unicode61 토크나이저: 한국어 어절 + 영어 단어 + URL 토큰 모두 인덱싱

-- ==============================
-- FTS5 가상 테이블
-- ==============================
-- standalone 방식 (external content 아님) — item_id로 items 테이블과 JOIN
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
  item_id UNINDEXED,
  title,
  content,
  url,
  tokenize = 'unicode61 remove_diacritics 1'
);

-- ==============================
-- 동기화 트리거 (items 변경 → items_fts 자동 반영)
-- ==============================

-- INSERT
CREATE TRIGGER IF NOT EXISTS items_fts_after_insert
AFTER INSERT ON items
FOR EACH ROW
BEGIN
  INSERT INTO items_fts (item_id, title, content, url)
  VALUES (
    NEW.id,
    COALESCE(NEW.title, ''),
    COALESCE(NEW.content, ''),
    COALESCE(NEW.url, '')
  );
END;

-- DELETE (hard delete 시 — 소프트 삭제는 items.is_deleted=1로 처리하며 FTS는 유지)
CREATE TRIGGER IF NOT EXISTS items_fts_after_delete
AFTER DELETE ON items
FOR EACH ROW
BEGIN
  DELETE FROM items_fts WHERE item_id = OLD.id;
END;

-- UPDATE (title/content/url 변경 시만)
CREATE TRIGGER IF NOT EXISTS items_fts_after_update
AFTER UPDATE OF title, content, url ON items
FOR EACH ROW
BEGIN
  DELETE FROM items_fts WHERE item_id = OLD.id;
  INSERT INTO items_fts (item_id, title, content, url)
  VALUES (
    NEW.id,
    COALESCE(NEW.title, ''),
    COALESCE(NEW.content, ''),
    COALESCE(NEW.url, '')
  );
END;
