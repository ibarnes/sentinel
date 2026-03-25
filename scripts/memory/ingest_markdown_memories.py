#!/usr/bin/env python3
import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path('/home/ec2-user/.openclaw/workspace')
DB = ROOT / 'memory/sqlite/memory.db'
FILES = [ROOT / 'MEMORY.md'] + sorted((ROOT / 'memory').glob('*.md'))

HEAD_RE = re.compile(r'^(#{1,6})\s+(.*)$')
BULLET_RE = re.compile(r'^\s*[-*]\s+(.*)$')


def classify(title: str, body: str) -> str:
    t = (title + ' ' + body).lower()
    if 'rule' in t or 'operating' in t or 'policy' in t:
        return 'rule'
    if 'decision' in t or 'approved' in t:
        return 'decision'
    if 'project' in t or 'initiative' in t or 'workflow' in t:
        return 'project'
    if 'todo' in t or 'next action' in t:
        return 'todo'
    if any(x in t for x in ['name:', 'call me:', 'profile']):
        return 'person'
    return 'note'


def tags_for(text: str):
    t = text.lower()
    tags = []
    for k in ['usg', 'angola', 'usvi', 'buyer', 'signal', 'workflow', 'governance', 'capital', 'telegram', 'dashboard', 'memory']:
        if k in t:
            tags.append(k)
    return sorted(set(tags))


def split_sections(lines):
    sections = []
    cur_title = 'Document'
    cur_start = 1
    cur_lines = []
    for i, line in enumerate(lines, start=1):
        m = HEAD_RE.match(line)
        if m:
            if cur_lines:
                sections.append((cur_title, cur_start, i - 1, '\n'.join(cur_lines).strip()))
            cur_title = m.group(2).strip()
            cur_start = i
            cur_lines = []
        else:
            cur_lines.append(line)
    if cur_lines:
        sections.append((cur_title, cur_start, len(lines), '\n'.join(cur_lines).strip()))
    return sections


def upsert_item(cur, item):
    cur.execute('SELECT id FROM memory_items WHERE hash=?', (item['hash'],))
    row = cur.fetchone()
    if row:
        cur.execute('''
            UPDATE memory_items
            SET item_type=?, title=?, body=?, source_path=?, source_line_start=?, source_line_end=?,
                source_kind=?, confidence=?, updated_at=?, effective_date=?, actor_refs=?, initiative_refs=?, tags=?
            WHERE id=?
        ''', (
            item['item_type'], item['title'], item['body'], item['source_path'], item['source_line_start'], item['source_line_end'],
            item['source_kind'], item['confidence'], item['updated_at'], item['effective_date'], item['actor_refs'], item['initiative_refs'], item['tags'], row[0]
        ))
        return 'updated'
    else:
        cur.execute('''
            INSERT INTO memory_items(item_type,title,body,source_path,source_line_start,source_line_end,source_kind,confidence,created_at,updated_at,effective_date,actor_refs,initiative_refs,tags,hash)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ''', (
            item['item_type'], item['title'], item['body'], item['source_path'], item['source_line_start'], item['source_line_end'],
            item['source_kind'], item['confidence'], item['created_at'], item['updated_at'], item['effective_date'], item['actor_refs'], item['initiative_refs'], item['tags'], item['hash']
        ))
        return 'inserted'


def main():
    if not DB.exists():
        raise SystemExit('memory db missing; run init_memory_db.py first')

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    ins = upd = 0

    for fp in FILES:
        if not fp.exists():
            continue
        text = fp.read_text(encoding='utf-8', errors='ignore')
        lines = text.splitlines()
        for title, start, end, body in split_sections(lines):
            if not body.strip():
                continue
            item_type = classify(title, body)
            tags = tags_for(title + '\n' + body)
            h = hashlib.sha256((str(fp) + '|' + str(start) + '|' + title + '|' + body).encode('utf-8')).hexdigest()
            item = {
                'item_type': item_type,
                'title': title,
                'body': body,
                'source_path': str(fp),
                'source_line_start': start,
                'source_line_end': end,
                'source_kind': 'markdown',
                'confidence': 'medium',
                'created_at': now,
                'updated_at': now,
                'effective_date': None,
                'actor_refs': '[]',
                'initiative_refs': '[]',
                'tags': json.dumps(tags),
                'hash': h,
            }
            r = upsert_item(cur, item)
            if r == 'inserted':
                ins += 1
            else:
                upd += 1

    conn.commit()
    conn.close()
    print(json.dumps({'inserted': ins, 'updated': upd, 'db': str(DB)}))


if __name__ == '__main__':
    main()
