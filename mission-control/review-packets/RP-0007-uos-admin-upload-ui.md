# RP-0007 — Password-Protected Admin Upload UI for UOS Files

## Title
Password-Protected Admin Upload UI (Execution Engine, Canon, Revenue OS)

## Summary
Implemented a local admin service scaffold (Node/Express) behind nginx for secure upload and processing of three UOS doctrine categories with multiple files per category. The flow now supports password login, session cookies, file validation, normalization, archive/versioning, state rebuild, snapshots, changelog updates, and admin action logging.

## Deliverable Paths
- Backend service:
  - `admin-server/src/server.js`
  - `admin-server/package.json`
  - `admin-server/.env.example`
  - `admin-server/.gitignore`
- Deployment:
  - `admin-server/deploy/nginx-admin.conf`
  - `admin-server/deploy/uos-admin.service`
- Runbook:
  - `admin-server/IMPLEMENTATION.md`
- Dashboard state/read-only support:
  - `dashboard/state/state.json`
  - `dashboard/state/changelog.md`
  - `dashboard/public/last-updated.js`

## Scope Coverage vs Request
- `/admin/login` password auth: ✅
- Password hash via env var (no plaintext): ✅
- HttpOnly session cookie with expiry: ✅
- `/admin/upload` with exactly 3 categories (multi-file per category): ✅
- Type + size validation: ✅
- Inbox/current/archive/versioning: ✅
- UOS index rebuild: ✅
- PDF/DOCX extraction to markdown: ✅
- State rebuild + snapshot + changelog: ✅
- Dashboard remains read-only: ✅ (nginx `limit_except GET HEAD` rule)
- Login rate limiting: ✅ (in-memory)
- Admin action logs: ✅
- No committed secrets: ✅

## Notes / Limits
- Login rate limit is in-memory (resets on process restart).
- PDF/DOCX extraction is plain-text extraction (not layout-preserving).
- Existing dashboard HTML may need one small include to render the new “Last updated” block (`dashboard/public/last-updated.js`).

## Recommended Next Step
Approve deployment wiring (nginx include + systemd enable) and run the end-to-end test flow before tomorrow 10:00 ET deadline.
