# Credentialed Wrapper Dry-Run (Fail-Fast) — 2026-03-22T10:40:00Z

- Command: `bash scripts/pipeline-run-credentialed-once.sh`
- Expected behavior: fail fast when required env vars are missing
- Exit condition: blocked by missing credentials (as designed)

## Output

```text
ERROR: BASE_URL and TEAM_SESSION_COOKIE must be set
```

## Interpretation

- Wrapper fail-fast guard is functioning.
- Live credentialed execution remains blocked until both `BASE_URL` and `TEAM_SESSION_COOKIE` are provided.
