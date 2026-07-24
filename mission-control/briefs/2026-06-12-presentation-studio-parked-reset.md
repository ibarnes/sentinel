# Presentation Studio Parked-State Reset

Date: 2026-06-12
Owner: Sentinel
Decision source: Isaac direct instruction on 2026-06-12 to abandon Presentation Studio as an active product build for now.

## Decision

Presentation Studio is no longer an active primary product-build lane.

Effective immediately:

- Do not treat Presentation Studio backlog or review artifacts as evidence of current product progress.
- Do not spend default automation cycles trying to finish the Studio.
- Use Claude and NotebookLM as the active deck-generation stack.
- Keep only the useful support surfaces from this system: initiative context, artifact storage, deck source organization, workflow logging, and related operational memory.

## Why This Reset Was Required

- Isaac explicitly called out that after roughly four months of automation, the frontend still behaves largely the same and remains mostly unusable.
- Board inspection showed heavy artifact accumulation without corresponding user-visible Studio delivery.
- The automation drifted into blocker maintenance, board recovery, and credentialed `/pipeline/run` churn instead of shipping the editor experience.

## What Exists And Is Worth Keeping Dormant

These are real assets, but they should be treated as dormant infrastructure rather than an active roadmap:

- Deck API surface
- Slide CRUD API surface
- Template endpoints
- Savepoint endpoints
- Savepoint restore path
- Pipeline run record scaffolding
- Legacy-to-v2 mapping groundwork

Representative completed task lineage:

- `TASK-0014`, `TASK-0015`
- `TASK-0020` through `TASK-0027`
- `TASK-0047` through `TASK-0052`
- `TASK-0093`, `TASK-0094`, `TASK-0096`

## What Did Not Get Built

The usable product layer was not carried through:

- `TASK-0010` EP-E Studio UI v2 Shell
- `TASK-0031` Pipeline Engine as real workflow
- `TASK-0035` AI Slides mode panel and instruction loop
- `TASK-0037` Team Chat per deck

Net: plumbing exists, but the editor/product experience never became trustworthy enough to use as the primary deck workflow.

## Board Handling Rule

All non-done Presentation Studio tasks should be considered parked unless Isaac explicitly reactivates the Studio effort later with a narrower mandate.

Operational rule:

- Keep completed Studio backend tasks as dormant assets.
- Keep non-done Studio tasks visible for historical traceability, but mark them parked/non-primary.
- Do not let future board summaries count parked Studio backlog as active roadmap delivery.

## Practical Operating Mode Going Forward

- Primary deck generation: Claude / NotebookLM
- This system's role: support stack only
- Default automation focus: no Presentation Studio build work unless explicitly re-opened by Isaac

## Re-Entry Condition

Only restart Presentation Studio as an active build lane if all of the following are true:

- Isaac explicitly reopens the product effort
- One narrow user-facing surface is chosen
- Success is defined as a shipped visible delta, not more board artifacts
- The work is bounded away from board-recovery loops
