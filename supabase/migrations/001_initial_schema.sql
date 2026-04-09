-- TeamVault Phase 1 초기 스키마
-- Supabase Dashboard > SQL Editor에서 실행하거나 supabase db push로 적용

-- pg_trgm 확장 활성화 (한국어+영어 부분 일치 검색)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==============================
-- TABLES
-- ==============================

-- 팀
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  invite_code VARCHAR(64) NOT NULL UNIQUE,
  invite_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 사용자 (Supabase Auth와 연동)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  avatar_url TEXT,
  is_anonymized BOOLEAN DEFAULT FALSE NOT NULL,
  anonymized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 탈퇴 이메일 차단 목록 (재가입 방지, 해시만 저장)
CREATE TABLE IF NOT EXISTS deleted_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash VARCHAR(64) NOT NULL UNIQUE,
  deleted_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  blocked_until TIMESTAMPTZ NOT NULL
);

-- 사용자-팀 연결 (N:N)
CREATE TABLE IF NOT EXISTS user_teams (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  left_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, team_id)
);

-- 태그
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(30) NOT NULL,
  color VARCHAR(7),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE (name, team_id)
);

-- 콘텐츠 아이템
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('link', 'note', 'file', 'ai_chat')),
  title VARCHAR(500) NOT NULL,
  content TEXT CHECK (length(content) <= 50000),
  url TEXT,
  url_hash VARCHAR(64),
  file_path TEXT,
  file_mime VARCHAR(100),
  thumbnail_url TEXT,
  collection_id UUID,
  is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
  view_count INTEGER DEFAULT 0 NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 아이템-태그 연결 (N:N)
CREATE TABLE IF NOT EXISTS item_tags (
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  is_auto BOOLEAN DEFAULT FALSE NOT NULL,
  PRIMARY KEY (item_id, tag_id)
);

-- ==============================
-- DB 레벨 제약 조건 (Race Condition 방지)
-- ==============================

-- 팀당 최대 20명 제약
CREATE OR REPLACE FUNCTION check_team_member_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_teams WHERE team_id = NEW.team_id AND left_at IS NULL) >= 20 THEN
    RAISE EXCEPTION 'team_member_limit_exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_team_member_limit
  BEFORE INSERT ON user_teams
  FOR EACH ROW EXECUTE FUNCTION check_team_member_limit();

-- 사용자당 최대 5팀 제약
CREATE OR REPLACE FUNCTION check_user_team_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM user_teams WHERE user_id = NEW.user_id AND left_at IS NULL) >= 5 THEN
    RAISE EXCEPTION 'user_team_limit_exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_user_team_limit
  BEFORE INSERT ON user_teams
  FOR EACH ROW EXECUTE FUNCTION check_user_team_limit();

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==============================
-- 검색 인덱스 (pg_trgm + tsvector)
-- ==============================

CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON items USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_content_trgm ON items USING GIN (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_items_search_vec ON items USING GIN (
  to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(content, ''))
);
CREATE INDEX IF NOT EXISTS idx_items_team_id ON items (team_id);
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams (team_id);
CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams (user_id);
CREATE INDEX IF NOT EXISTS idx_tags_team_id ON tags (team_id);
CREATE INDEX IF NOT EXISTS idx_deleted_emails_hash ON deleted_emails (email_hash);

-- ==============================
-- ROW LEVEL SECURITY (RLS)
-- ==============================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_emails ENABLE ROW LEVEL SECURITY;

-- users: 본인만 조회/수정 + 같은 팀원은 기본 정보 조회 가능
CREATE POLICY "users_select_own" ON users FOR SELECT
  USING (
    auth.uid() = id
    OR id IN (
      SELECT ut2.user_id FROM user_teams ut1
      JOIN user_teams ut2 ON ut1.team_id = ut2.team_id
      WHERE ut1.user_id = auth.uid() AND ut1.left_at IS NULL AND ut2.left_at IS NULL
    )
  );

CREATE POLICY "users_update_own" ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "users_insert_own" ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- teams: 소속 팀만 조회
CREATE POLICY "teams_select_member" ON teams FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "teams_insert_any" ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "teams_update_admin" ON teams FOR UPDATE
  USING (
    id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND role = 'admin' AND left_at IS NULL
    )
  );

-- user_teams: 같은 팀원 조회 가능
CREATE POLICY "user_teams_select_member" ON user_teams FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "user_teams_insert_self" ON user_teams FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_teams_update_self_or_admin" ON user_teams FOR UPDATE
  USING (
    user_id = auth.uid()
    OR team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND role = 'admin' AND left_at IS NULL
    )
  );

-- items: 같은 팀 + is_deleted=false 필터 RLS 레벨 적용
CREATE POLICY "items_select_team" ON items FOR SELECT
  USING (
    is_deleted = FALSE
    AND team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "items_insert_member" ON items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

-- 수정: 본인만
CREATE POLICY "items_update_owner" ON items FOR UPDATE
  USING (created_by = auth.uid());

-- 소프트 삭제: 본인 또는 admin
CREATE POLICY "items_softdelete_owner_or_admin" ON items FOR UPDATE
  USING (
    created_by = auth.uid()
    OR team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND role = 'admin' AND left_at IS NULL
    )
  );

-- tags: 같은 팀 조회/수정
CREATE POLICY "tags_select_team" ON tags FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "tags_insert_member" ON tags FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

-- item_tags: items와 동일 팀 기준
CREATE POLICY "item_tags_select_team" ON item_tags FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE team_id IN (
        SELECT team_id FROM user_teams
        WHERE user_id = auth.uid() AND left_at IS NULL
      )
    )
  );

CREATE POLICY "item_tags_insert_member" ON item_tags FOR INSERT
  WITH CHECK (
    item_id IN (
      SELECT id FROM items
      WHERE team_id IN (
        SELECT team_id FROM user_teams
        WHERE user_id = auth.uid() AND left_at IS NULL
      )
    )
  );

CREATE POLICY "item_tags_delete_owner_or_admin" ON item_tags FOR DELETE
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE created_by = auth.uid()
      OR team_id IN (
        SELECT team_id FROM user_teams
        WHERE user_id = auth.uid() AND role = 'admin' AND left_at IS NULL
      )
    )
  );

-- deleted_emails: 서비스 롤만 접근 (RLS 완전 차단)
CREATE POLICY "deleted_emails_no_access" ON deleted_emails FOR ALL
  USING (FALSE);
