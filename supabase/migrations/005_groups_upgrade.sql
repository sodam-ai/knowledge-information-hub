-- 그룹 플랫폼 업그레이드
-- 1. teams 테이블에 공개/비공개, 설명, 카테고리 추가
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS description VARCHAR(200),
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) CHECK (
    category IS NULL OR category IN (
      'ai', 'dev', 'design', 'marketing', 'study', 'business', 'investment', 'etc'
    )
  );

-- 2. 공개 그룹 탐색용 인덱스
CREATE INDEX IF NOT EXISTS idx_teams_public_created
  ON teams(created_at DESC) WHERE is_public = TRUE;

CREATE INDEX IF NOT EXISTS idx_teams_public_category
  ON teams(category, created_at DESC) WHERE is_public = TRUE AND category IS NOT NULL;

-- 3. 사용자당 그룹 제한 5 → 10으로 완화
CREATE OR REPLACE FUNCTION check_user_team_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM user_teams
    WHERE user_id = NEW.user_id AND left_at IS NULL
  ) >= 10 THEN
    RAISE EXCEPTION 'user_team_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. 팀 인원 제한: 공개 그룹 500명, 비공개 20명
CREATE OR REPLACE FUNCTION check_team_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_is_public BOOLEAN;
  v_max_members INT;
  v_current_count INT;
BEGIN
  SELECT is_public INTO v_is_public FROM teams WHERE id = NEW.team_id;
  v_max_members := CASE WHEN v_is_public THEN 500 ELSE 20 END;

  SELECT COUNT(*) INTO v_current_count
  FROM user_teams WHERE team_id = NEW.team_id AND left_at IS NULL;

  IF v_current_count >= v_max_members THEN
    RAISE EXCEPTION 'team_member_limit_exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. 공개 그룹 탐색: 로그인 사용자는 공개 그룹 목록 조회 가능
--    (콘텐츠 items/tags 등은 기존 멤버십 정책 유지)
DROP POLICY IF EXISTS "teams_select_member" ON teams;

CREATE POLICY "teams_select_member" ON teams FOR SELECT
  USING (
    is_public = TRUE
    OR id IN (SELECT team_id FROM get_my_team_ids())
  );

-- 6. 공개 그룹 멤버 수 조회용 함수 (개인정보 노출 없이 숫자만 반환)
CREATE OR REPLACE FUNCTION get_group_member_count(p_team_id UUID)
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM user_teams
  WHERE team_id = p_team_id AND left_at IS NULL;
$$;

-- 7. 공개 그룹 목록 조회용 RPC (탐색 페이지용, 성능 최적화)
CREATE OR REPLACE FUNCTION get_public_groups(
  p_category TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  description VARCHAR,
  category VARCHAR,
  is_public BOOLEAN,
  created_at TIMESTAMPTZ,
  member_count INT,
  is_joined BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.description,
    t.category,
    t.is_public,
    t.created_at,
    COUNT(ut.user_id)::INT AS member_count,
    EXISTS(
      SELECT 1 FROM user_teams ut2
      WHERE ut2.team_id = t.id
        AND ut2.user_id = auth.uid()
        AND ut2.left_at IS NULL
    ) AS is_joined
  FROM teams t
  LEFT JOIN user_teams ut ON ut.team_id = t.id AND ut.left_at IS NULL
  WHERE t.is_public = TRUE
    AND (p_category IS NULL OR t.category = p_category)
  GROUP BY t.id
  ORDER BY member_count DESC, t.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
