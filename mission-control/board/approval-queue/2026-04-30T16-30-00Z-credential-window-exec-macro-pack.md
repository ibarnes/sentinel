# Credential Window Exec Macro Pack — 2026-04-30 16:30 UTC

Parent stream: TASK-0097 / TASK-0103

## Purpose
Shrink time-to-execution once credentials arrive by pre-baking command macros and evidence paths.

## Required inputs
- `BASE_URL`
- `TEAM_SESSION_COOKIE`

## Single-pass command chain
```bash
node mission-control/pipeline-run/check-credential-window.mjs \
  --base-url "$BASE_URL" \
  --cookie "$TEAM_SESSION_COOKIE" \
  --emit mission-control/evidence/pipeline-run/$(date -u +%Y-%m-%dT%H-%M-%SZ)-preflight.md \
&& node mission-control/pipeline-run/run-authenticated-smoke.mjs \
  --base-url "$BASE_URL" \
  --cookie "$TEAM_SESSION_COOKIE" \
  --emit mission-control/evidence/pipeline-run/$(date -u +%Y-%m-%dT%H-%M-%SZ)-auth-smoke.md
```

## Acceptance checklist
- [ ] Preflight evidence file emitted
- [ ] Auth smoke evidence file emitted (201 + 400 assertions)
- [ ] RP updated with both evidence refs
- [ ] BOARD status replay posted
