---
rp_id: RP-0012
title: Overnight Command Interface Readiness Plan
linked_task: TASK-OPS-OVERNIGHT
created_by: sentinel
created_at: 2026-02-25T00:00:00Z
status: Archived
recommended_action: Monitor
architect_decision: null
architect_notes: null
---

# RP-0012 — Overnight Command Interface Readiness Plan

## Objective
Prepare the current admin/dashboard stack to be team-ready as a command interface by tomorrow morning.

## Overnight Workstream

### 1) UX + Reliability Hardening
- Add clearer success/failure toasts and validation summaries on upload page.
- Add upload preflight checks (expected total count + category count visibility).
- Add graceful error page for failed normalization of individual files (partial-failure reporting).

### 2) Operational Controls
- Add an Admin "Runbook" page in UI:
  - Login
  - Upload workflow
  - Validation checks
  - Escalation path
- Add "System Status" panel:
  - admin service health
  - last successful upload timestamp
  - last snapshot path

### 3) Data Integrity + Observability
- Add post-upload integrity verifier command and output file.
- Add checksum manifest for each archive batch.
- Add concise operator-readable audit summary file per upload.

### 4) Team-Ready Demo Surface
- Improve dashboard read-only landing page with:
  - current state summary cards
  - category file counts
  - quick links to latest snapshot/changelog
- Add "What changed" block from latest changelog entry.

### 5) Security Tightening
- Add forced password rotation helper script (regen hash).
- Add optional session timeout warning UX.
- Keep no-secret-in-repo policy intact.

## Deliverables by Morning
- Updated admin UI with operational polish
- Read-only dashboard summary fit for team walkthrough
- Added runbook docs
- Integrity + checksum utilities
- Review packet with before/after and usage steps

## Constraints
- No external account connections.
- No irreversible actions.
- Keep gateway/UI stable; avoid disruptions.
