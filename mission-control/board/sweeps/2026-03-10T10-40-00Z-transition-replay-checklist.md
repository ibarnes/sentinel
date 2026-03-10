# Post-Credential Transition Replay Checklist (TASK-0133)

Timestamp: 2026-03-10T10:40:00Z
Scope: Apply deterministic BOARD.json transitions in <30 min after credentialed smoke evidence arrives.

## Preconditions
1. Evidence artifact exists in `mission-control/evidence/pipeline-run/`.
2. Artifact contains both:
   - Valid-path HTTP 201 with `runId` + `started` status
   - Invalid-path HTTP 400 deterministic payload
3. Evidence path is pasted into TASK-0111 comment.

## Replay order (strict)
1. Update TASK-0111 comment + status.
2. Update TASK-0103 using macro branch (success/failure).
3. Update TASK-0097 using macro branch.
4. Update TASK-0095 using macro branch.
5. Update TASK-0043 using macro branch.

## Status transition map (success path)
- TASK-0111: Backlog -> Ready for Review
- TASK-0103: In Progress -> Ready for Review
- TASK-0097: In Progress -> Ready for Review
- TASK-0095: In Progress -> Ready for Review
- TASK-0043: In Progress -> Ready for Review

## Status transition map (failure path)
- TASK-0111: Backlog -> In Progress (with failure evidence)
- TASK-0103: remains In Progress
- TASK-0097: remains In Progress
- TASK-0095: remains In Progress
- TASK-0043: remains In Progress

## Required comment fields per updated task
- UTC timestamp
- Evidence file path
- Branch used (success/failure)
- Remaining blocker (if any)
- Next-check date (if failure)

## Governance checks
- No task moved to Done in this replay.
- If any task enters Ready for Review, include RP reference where applicable.
