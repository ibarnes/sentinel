# Pipeline Run Smoke Harness Matrix — 2026-04-27 10:40 UTC

Parent: `TASK-0095`
Child: `TASK-0255`

## Command Matrix

| Path | Preconditions | Command shape | Expected outcome | Evidence artifact |
|---|---|---|---|---|
| Success (201) | `BASE_URL`, valid session cookie, valid body | `curl -X POST "$BASE_URL/api/presentation-studio/decks/$DECK_ID/pipeline/run" ...` | `201` with `runId` + `started` | `credentialed-wrapper-dryrun` + response body capture |
| Validation failure (400) | `BASE_URL`, valid session cookie, intentionally invalid body | same endpoint, invalid `mode`/missing required field | `400` with actionable error payload | `preflight` + invalid-request response capture |
| Credential-missing fail-fast | No cookie set | wrapper command without `TEAM_SESSION_COOKIE` | deterministic fail-fast (no network side effects) | fail-fast wrapper output log |

## Evidence Checklist
- [ ] Request/response capture for 201 path (headers + body).
- [ ] Request/response capture for 400 path with exact validation error.
- [ ] RunId evidence linked to created audit event (`pipeline.run.created`).
- [ ] Preflight environment evidence (`BASE_URL` present, cookie redacted/length check).
- [ ] Fail-fast proof when credentials absent (explicit guard message).
- [ ] Board comment template prepared for replay transitions after PASS window.

## Execution Order
1. Fail-fast guard check (credential-missing path).
2. Preflight capture with credential presence assertion.
3. 201 success path run + evidence.
4. 400 invalid-input path run + evidence.
5. Attach artifacts to parent tasks (`TASK-0095`, `TASK-0097`, `TASK-0103`) as applicable.
