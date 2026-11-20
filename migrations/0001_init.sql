-- Cloudflare D1 is SQLite. A versioned snapshot supports safe, atomic updates
-- and detects concurrent edits across multiple phones.
CREATE TABLE IF NOT EXISTS app_state (
 id INTEGER PRIMARY KEY CHECK(id=1),
 payload TEXT NOT NULL CHECK(json_valid(payload)),
 revision INTEGER NOT NULL DEFAULT 0,
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO app_state(id,payload,revision) VALUES
 (1,'{"opening":0,"entries":[],"pending":[],"cars":[]}',0);
