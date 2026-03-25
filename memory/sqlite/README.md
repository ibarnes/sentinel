# SQLite Memory Layer

This is a local memory system-of-record for operational recall.

## Files
- `memory.db` — SQLite database (WAL mode)
- `scripts/memory/init_memory_db.py` — initialize schema + FTS index
- `scripts/memory/ingest_markdown_memories.py` — ingest `MEMORY.md` + `memory/*.md`
- `scripts/memory/search_memory.py` — query memory by semantic-ish FTS and filters

## Quick start
```bash
python scripts/memory/init_memory_db.py
python scripts/memory/ingest_markdown_memories.py
python scripts/memory/search_memory.py "USVI Adrienne" --limit 10
```

## Notes
- This layer is append/update friendly and auditable.
- It keeps markdown as source-of-truth input while enabling fast structured retrieval.
- Future upgrade path: add embedding vectors table + rerank pipeline.
