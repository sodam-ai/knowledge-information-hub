-- Phase 3: 컬렉션(폴더) 기능
-- items.collection_id 컬럼은 이미 존재 (FK 없는 UUID) → 테이블 생성 후 FK 추가

-- 1. collections 테이블
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (name, team_id)
);

CREATE INDEX IF NOT EXISTS idx_collections_team_id ON collections (team_id);

-- 2. items.collection_id → collections.id FK (기존 컬럼 재활용, NULL 허용)
ALTER TABLE items
  ADD CONSTRAINT fk_items_collection_id
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL;

-- 3. RLS
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collections_select_team" ON collections FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "collections_insert_member" ON collections FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND left_at IS NULL
    )
  );

CREATE POLICY "collections_delete_owner_or_admin" ON collections FOR DELETE
  USING (
    created_by = auth.uid()
    OR team_id IN (
      SELECT team_id FROM user_teams
      WHERE user_id = auth.uid() AND role = 'admin' AND left_at IS NULL
    )
  );
