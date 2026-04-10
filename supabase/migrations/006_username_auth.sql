-- 사용자명(username) 기반 PIN 인증 지원
-- 기존 OAuth 사용자는 username NULL 유지, 신규 PIN 가입자만 username 설정

ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(30);

-- NULL은 중복 허용 (기존 OAuth 사용자), non-NULL은 유일해야 함
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username
  ON users (username)
  WHERE username IS NOT NULL;
