CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE UNIQUE INDEX items_by_wardrobe_and_id ON items (wardrobe_id, id);

CREATE TABLE outfits (
  id TEXT PRIMARY KEY,
  wardrobe_id TEXT NOT NULL REFERENCES wardrobes(id),
  favorite INTEGER NOT NULL DEFAULT 0 CHECK (favorite IN (0, 1)),
  created_at INTEGER NOT NULL,
  UNIQUE (wardrobe_id, id)
) STRICT;

CREATE INDEX outfits_by_wardrobe ON outfits (wardrobe_id, created_at DESC);

CREATE TABLE outfit_items (
  wardrobe_id TEXT NOT NULL,
  outfit_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  PRIMARY KEY (outfit_id, position),
  UNIQUE (outfit_id, item_id),
  FOREIGN KEY (wardrobe_id, outfit_id) REFERENCES outfits(wardrobe_id, id) ON DELETE CASCADE,
  FOREIGN KEY (wardrobe_id, item_id) REFERENCES items(wardrobe_id, id)
) STRICT;

PRAGMA user_version = 2;
