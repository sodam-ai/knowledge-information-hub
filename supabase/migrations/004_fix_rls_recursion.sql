-- RLS 무한 재귀 수정
-- user_teams 정책이 user_teams를 재참조하여 recursion 발생
-- SECURITY DEFINER 함수로 RLS 우회하여 해결

-- 1. 헬퍼 함수 생성 (RLS 우회하여 내 팀 ID 반환)
CREATE OR REPLACE FUNCTION get_my_team_ids()
RETURNS TABLE(team_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ut.team_id FROM public.user_teams ut
  WHERE ut.user_id = auth.uid() AND ut.left_at IS NULL;
$$;

-- 관리자 팀 ID 반환 함수
CREATE OR REPLACE FUNCTION get_my_admin_team_ids()
RETURNS TABLE(team_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ut.team_id FROM public.user_teams ut
  WHERE ut.user_id = auth.uid() AND ut.role = 'admin' AND ut.left_at IS NULL;
$$;

-- 2. 재귀 유발 정책 교체

-- user_teams 기존 정책 삭제
DROP POLICY IF EXISTS "user_teams_select_member" ON user_teams;
DROP POLICY IF EXISTS "user_teams_update_self_or_admin" ON user_teams;

-- user_teams 재생성 (함수 사용)
CREATE POLICY "user_teams_select_member" ON user_teams FOR SELECT
  USING (team_id IN (SELECT team_id FROM get_my_team_ids()));

CREATE POLICY "user_teams_update_self_or_admin" ON user_teams FOR UPDATE
  USING (
    user_id = auth.uid()
    OR team_id IN (SELECT team_id FROM get_my_admin_team_ids())
  );

-- 3. 다른 테이블 정책도 함수 사용으로 교체 (user_teams 재귀 방지)

-- teams
DROP POLICY IF EXISTS "teams_select_member" ON teams;
DROP POLICY IF EXISTS "teams_update_admin" ON teams;

CREATE POLICY "teams_select_member" ON teams FOR SELECT
  USING (id IN (SELECT team_id FROM get_my_team_ids()));

CREATE POLICY "teams_update_admin" ON teams FOR UPDATE
  USING (id IN (SELECT team_id FROM get_my_admin_team_ids()));

-- items
DROP POLICY IF EXISTS "items_select_team" ON items;
DROP POLICY IF EXISTS "items_insert_member" ON items;
DROP POLICY IF EXISTS "items_softdelete_owner_or_admin" ON items;

CREATE POLICY "items_select_team" ON items FOR SELECT
  USING (is_deleted = FALSE AND team_id IN (SELECT team_id FROM get_my_team_ids()));

CREATE POLICY "items_insert_member" ON items FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND team_id IN (SELECT team_id FROM get_my_team_ids())
  );

CREATE POLICY "items_softdelete_owner_or_admin" ON items FOR UPDATE
  USING (
    created_by = auth.uid()
    OR team_id IN (SELECT team_id FROM get_my_admin_team_ids())
  );

-- tags
DROP POLICY IF EXISTS "tags_select_team" ON tags;
DROP POLICY IF EXISTS "tags_insert_member" ON tags;

CREATE POLICY "tags_select_team" ON tags FOR SELECT
  USING (team_id IN (SELECT team_id FROM get_my_team_ids()));

CREATE POLICY "tags_insert_member" ON tags FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM get_my_team_ids()));

-- item_tags
DROP POLICY IF EXISTS "item_tags_select_team" ON item_tags;
DROP POLICY IF EXISTS "item_tags_insert_member" ON item_tags;
DROP POLICY IF EXISTS "item_tags_delete_owner_or_admin" ON item_tags;

CREATE POLICY "item_tags_select_team" ON item_tags FOR SELECT
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE team_id IN (SELECT team_id FROM get_my_team_ids())
    )
  );

CREATE POLICY "item_tags_insert_member" ON item_tags FOR INSERT
  WITH CHECK (
    item_id IN (
      SELECT id FROM items
      WHERE team_id IN (SELECT team_id FROM get_my_team_ids())
    )
  );

CREATE POLICY "item_tags_delete_owner_or_admin" ON item_tags FOR DELETE
  USING (
    item_id IN (
      SELECT id FROM items
      WHERE created_by = auth.uid()
      OR team_id IN (SELECT team_id FROM get_my_admin_team_ids())
    )
  );
