---
rp_id: RP-0040
title: Presentation Studio Template Library APIs (list/detail)
linked_task: TASK-0026
created_by: sentinel
created_at: 2026-03-08T04:10:00Z
status: Ready for Review
recommended_action: Approve
architect_decision: null
architect_notes: null
---

# RP-0040 — Presentation Studio Template Library APIs (list/detail)

## Summary
Implemented template library read APIs for Presentation Studio:
- `GET /api/presentation-studio/templates`
- `GET /api/presentation-studio/templates/:templateId`

Endpoints are backed by template manifest files under `dashboard/templates/presentation-templates/*/template.json` and return deterministic JSON payloads for both list and detail retrieval.

## Observations
- Story TASK-0026 was still open with no template list/detail API despite templates already existing on disk.
- The work item was decomposed into 30–90 minute subtasks (contract → implementation → smoke + review packet) before coding.
- Existing API role model (`architect|editor|observer`) was reused for read-only template access.

## Assumptions
- Template manifests are source-of-truth for API payload fields (`id`, `name`, `description`, `layouts`, optional `tokens`).
- Direct filesystem-backed reads are acceptable for current scale and can be cached later if needed.
- Missing or malformed manifests should be skipped in list output rather than crash the endpoint.

## Recommendations
1. Approve RP-0040 and move TASK-0026 forward as delivered list/detail slice.
2. Follow-on TASK-0027 should add savepoint APIs with the same deterministic response/error conventions.
3. If UI needs richer metadata, extend manifest schema explicitly (avoid ad-hoc fields in endpoint logic).

## Next Actions for Isaac
1. **Approve RP-0040** (unblocks TS-B3.1 and keeps EP-B API surface moving).
2. Confirm whether template endpoint should include slot schema/constraints in a second pass (currently returns manifest-defined fields only).
3. Prioritize TASK-0027 (savepoint list/create/restore) as next EP-B leverage item.

## Acceptance Evidence
- Code changes: `admin-server/src/server.js`
- Helpers added:
  - `readTemplateManifestById(templateId)`
  - `readTemplateLibraryIndex()`
- Endpoints added:
  - `GET /api/presentation-studio/templates`
  - `GET /api/presentation-studio/templates/:templateId`
- Validation smoke:
  - `node --check admin-server/src/server.js` (pass)
