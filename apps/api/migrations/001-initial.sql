CREATE TABLE wardrobes (
  id TEXT PRIMARY KEY
) STRICT;

CREATE TABLE items (
  id TEXT PRIMARY KEY,
  wardrobe_id TEXT NOT NULL REFERENCES wardrobes(id),
  category TEXT NOT NULL CHECK (category IN ('top', 'bottom', 'dress', 'outer', 'shoes', 'bag', 'accessory')),
  original_key TEXT NOT NULL UNIQUE,
  cutout_key TEXT,
  cutout_status TEXT NOT NULL DEFAULT 'failed' CHECK (cutout_status IN ('pending', 'done', 'failed')),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX items_by_wardrobe ON items (wardrobe_id, created_at DESC);
PRAGMA user_version = 1;
