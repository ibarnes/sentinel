#!/usr/bin/env python3
import argparse
import json
import sqlite3
from pathlib import Path

ROOT = Path('/home/ec2-user/.openclaw/workspace')
DB = ROOT / 'memory/sqlite/memory.db'


def main():
    ap = argparse.ArgumentParser(description='Search SQLite memory (FTS + filters).')
    ap.add_argument('query', nargs='?', default='')
    ap.add_argument('--type', dest='item_type', default='')
    ap.add_argument('--tag', default='')
    ap.add_argument('--limit', type=int, default=15)
    args = ap.parse_args()

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    where = []
    vals = []

    if args.query:
        where.append('id IN (SELECT rowid FROM memory_fts WHERE memory_fts MATCH ?)')
        vals.append(args.query)
    if args.item_type:
        where.append('item_type = ?')
        vals.append(args.item_type)
    if args.tag:
        where.append('tags LIKE ?')
        vals.append(f'%"{args.tag}"%')

    sql = 'SELECT id,item_type,title,substr(body,1,320) as body,source_path,source_line_start,source_line_end,updated_at,tags FROM memory_items'
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY updated_at DESC LIMIT ?'
    vals.append(args.limit)

    rows = [dict(r) for r in cur.execute(sql, vals).fetchall()]
    print(json.dumps(rows, indent=2, ensure_ascii=False))
    conn.close()


if __name__ == '__main__':
    main()
