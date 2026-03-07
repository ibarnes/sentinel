# Pipeline Run Smoke Evidence

Use this folder for authenticated smoke evidence artifacts tied to TASK-0097 / TASK-0103.

## Expected artifacts
- `YYYY-MM-DD-smoke-evidence.md` (completed evidence template)
- Optional raw command output logs (if captured)

## Minimum evidence requirements
1. Valid request path returns HTTP 201 with `runId` and `status=started`.
2. Invalid request path returns HTTP 400 with deterministic error payload.
3. Include timestamp (UTC), operator, base URL, deck ID, and command used.
