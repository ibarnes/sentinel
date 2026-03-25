#!/usr/bin/env python3
import sqlite3
from pathlib import Path

ROOT = Path('/home/ec2-user/.openclaw/workspace')
DB = ROOT / 'memory/sqlite/memory.db'
DB.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB)
cur = conn.cursor()
cur.execute('PRAGMA journal_mode=WAL;')
cur.execute('PRAGMA foreign_keys=ON;')

cur.executescript('''
CREATE TABLE IF NOT EXISTS memory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_type TEXT NOT NULL,             -- decision|rule|project|person|todo|note
  title TEXT,
  body TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_line_start INTEGER,
  source_line_end INTEGER,
  source_kind TEXT NOT NULL DEFAULT 'markdown',
  confidence TEXT DEFAULT 'medium',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  effective_date TEXT,
  actor_refs TEXT DEFAULT '[]',        -- JSON array
  initiative_refs TEXT DEFAULT '[]',   -- JSON array
  tags TEXT DEFAULT '[]',              -- JSON array
  hash TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS memory_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_item_id INTEGER NOT NULL,
  to_item_id INTEGER NOT NULL,
  link_type TEXT NOT NULL,
  FOREIGN KEY(from_item_id) REFERENCES memory_items(id) ON DELETE CASCADE,
  FOREIGN KEY(to_item_id) REFERENCES memory_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS memory_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  label TEXT,
  url TEXT,
  source_type TEXT DEFAULT 'internal',
  FOREIGN KEY(item_id) REFERENCES memory_items(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  title,
  body,
  tags,
  content='memory_items',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS memory_items_ai AFTER INSERT ON memory_items BEGIN
  INSERT INTO memory_fts(rowid, title, body, tags)
  VALUES (new.id, coalesce(new.title,''), new.body, coalesce(new.tags,''));
END;

CREATE TRIGGER IF NOT EXISTS memory_items_ad AFTER DELETE ON memory_items BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, title, body, tags)
  VALUES('delete', old.id, old.title, old.body, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS memory_items_au AFTER UPDATE ON memory_items BEGIN
  INSERT INTO memory_fts(memory_fts, rowid, title, body, tags)
  VALUES('delete', old.id, old.title, old.body, old.tags);
  INSERT INTO memory_fts(rowid, title, body, tags)
  VALUES (new.id, coalesce(new.title,''), new.body, coalesce(new.tags,''));
END;

CREATE INDEX IF NOT EXISTS idx_memory_items_type ON memory_items(item_type);
CREATE INDEX IF NOT EXISTS idx_memory_items_updated_at ON memory_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_memory_items_source_path ON memory_items(source_path);
''')

conn.commit()
conn.close()
print(f'Initialized {DB}')
