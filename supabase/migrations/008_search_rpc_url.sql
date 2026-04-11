-- search_items RPC — url 컬럼 검색 추가
-- 기존 002_search_rpc.sql의 WHERE 절에 url ILIKE 조건 추가

CREATE OR REPLACE FUNCTION search_items(p_team_id UUID, p_query TEXT)
RETURNS TABLE (
  id UUID,
  type VARCHAR,
  title VARCHAR,
  content TEXT,
  url TEXT,
  url_hash VARCHAR,
  is_pinned BOOLEAN,
  view_count INTEGER,
  team_id UUID,
  created_by UUID,
  is_deleted BOOLEAN,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity_score FLOAT
) LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT DISTINCT
    i.id, i.type, i.title, i.content, i.url, i.url_hash,
    i.is_pinned, i.view_count, i.team_id, i.created_by,
    i.is_deleted, i.deleted_at, i.created_at, i.updated_at,
    GREATEST(
      similarity(i.title, p_query),
      COALESCE(similarity(i.content, p_query), 0),
      COALESCE(similarity(i.url, p_query), 0),
      COALESCE(similarity(t.name, p_query), 0)
    ) AS similarity_score
  FROM items i
  LEFT JOIN item_tags it ON it.item_id = i.id
  LEFT JOIN tags t ON t.id = it.tag_id
  WHERE
    i.team_id = p_team_id
    AND i.is_deleted = FALSE
    AND (
      -- pg_trgm 부분 일치 (title, content, url, tag)
      i.title ILIKE '%' || p_query || '%'
      OR i.content ILIKE '%' || p_query || '%'
      OR i.url ILIKE '%' || p_query || '%'
      OR t.name ILIKE '%' || p_query || '%'
      -- tsvector 단어 단위 (한국어 어절)
      OR to_tsvector('simple', COALESCE(i.title, '') || ' ' || COALESCE(i.content, ''))
         @@ plainto_tsquery('simple', p_query)
    )
  ORDER BY similarity_score DESC, i.created_at DESC
  LIMIT 50;
$$;
