ALTER TABLE items
  ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_items_category ON items (category)
  WHERE category IS NOT NULL;
