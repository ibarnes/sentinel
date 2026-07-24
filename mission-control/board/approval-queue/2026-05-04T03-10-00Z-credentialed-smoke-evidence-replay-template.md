# Credentialed Smoke Evidence Replay Template (Queued)

Use after a successful one-pass credentialed run to close TASK-0103/TASK-0097 evidence gate.

## Required inserts
- Run timestamp:
- Operator:
- Command executed:
- Output bundle path:

## Evidence checks
- [ ] 201 response captured with `runId` and `status=started`
- [ ] 400 response captured with deterministic validation error payload
- [ ] Evidence report generated and linked
- [ ] Parent task comments updated with artifact links

## Transition requests (post-check)
- Request `TASK-0103` -> Ready for Review
- Request `TASK-0097` -> Ready for Review
- Keep governance rule: no Done transition without approved RP.
