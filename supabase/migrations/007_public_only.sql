-- 007: 공개 커뮤니티 전환
-- 모든 그룹을 공개로, 인증된 사용자라면 누구나 모든 콘텐츠를 볼 수 있도록 RLS 완화

-- ==============================
-- 1. 모든 팀을 공개로 업데이트
-- ==============================
UPDATE public.teams SET is_public = true WHERE is_public = false;

-- ==============================
-- 2. items SELECT RLS 완화
-- 기존: 팀 멤버만 조회 가능 (migration 004에서 생성된 정책)
-- 변경: 인증된 사용자라면 모든 팀의 아이템 조회 가능
-- ==============================
DROP POLICY IF EXISTS "items_select_team" ON public.items;

CREATE POLICY "items_select_public"
  ON public.items FOR SELECT
  TO authenticated
  USING (is_deleted = FALSE);

-- ==============================
-- 3. tags SELECT RLS 완화
-- ==============================
DROP POLICY IF EXISTS "tags_select_team" ON public.tags;

CREATE POLICY "tags_select_public"
  ON public.tags FOR SELECT
  TO authenticated
  USING (TRUE);

-- ==============================
-- 4. item_tags SELECT RLS 완화
-- ==============================
DROP POLICY IF EXISTS "item_tags_select_team" ON public.item_tags;

CREATE POLICY "item_tags_select_public"
  ON public.item_tags FOR SELECT
  TO authenticated
  USING (TRUE);

-- ==============================
-- 5. teams SELECT RLS 완화 (탐색 지원)
-- ==============================
DROP POLICY IF EXISTS "teams_select_member" ON public.teams;

CREATE POLICY "teams_select_public"
  ON public.teams FOR SELECT
  TO authenticated
  USING (TRUE);

-- ==============================
-- 6. get_all_groups RPC (get_public_groups 대체)
-- ==============================
CREATE OR REPLACE FUNCTION public.get_all_groups(
  p_category text  DEFAULT NULL,
  p_limit    int   DEFAULT 50,
  p_offset   int   DEFAULT 0
)
RETURNS TABLE (
  id           uuid,
  name         text,
  description  text,
  category     text,
  is_public    boolean,
  created_at   timestamptz,
  member_count bigint,
  is_joined    boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.description,
    t.category,
    t.is_public,
    t.created_at,
    COUNT(ut.user_id)::bigint AS member_count,
    EXISTS (
      SELECT 1 FROM user_teams
      WHERE user_id  = auth.uid()
        AND team_id  = t.id
        AND left_at IS NULL
    ) AS is_joined
  FROM teams t
  LEFT JOIN user_teams ut ON ut.team_id = t.id AND ut.left_at IS NULL
  WHERE (p_category IS NULL OR t.category = p_category)
  GROUP BY t.id
  ORDER BY member_count DESC, t.created_at DESC
  LIMIT  p_limit
  OFFSET p_offset;
$$;

-- ==============================
-- 7. 팀 멤버 한도 500명으로 상향 (공개 커뮤니티)
-- ==============================
CREATE OR REPLACE FUNCTION public.check_team_member_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM user_teams
    WHERE team_id = NEW.team_id AND left_at IS NULL
  ) >= 500 THEN
    RAISE EXCEPTION 'team_member_limit_exceeded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
