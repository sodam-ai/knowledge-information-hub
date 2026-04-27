-- 009: site_config 테이블
-- 비밀번호 기반 접근 제어용 설정 저장소
-- Supabase Dashboard > SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS public.site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 서버사이드 서비스 롤로만 접근 (RLS 비활성화)
ALTER TABLE public.site_config DISABLE ROW LEVEL SECURITY;
