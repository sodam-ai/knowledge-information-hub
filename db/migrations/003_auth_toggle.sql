-- 003_auth_toggle: 초기 진입 비밀번호 사용/사용 안함 토글
-- site_config 에 auth_enabled 키 추가 (default '1' = 켜짐)
-- '0' 으로 변경하면 /login 페이지가 자동 통과되어 비밀번호 입력 없이 대시보드 진입

INSERT OR IGNORE INTO site_config (key, value, updated_at)
VALUES ('auth_enabled', '1', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
