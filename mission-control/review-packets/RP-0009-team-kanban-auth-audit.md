# RP-0009 — Team Kanban + Auth + Audit Layer

## Title
Editable Task Board (Kanban) with Team Login, Roles, and Audit Trails

## Summary
Implemented a collaborative board system with team authentication and role controls, while keeping doctrine/UOS editing restricted to admin-only routes. Added board persistence, schema validation, append-only history/activity logs, board API endpoints, and board state integration into dashboard state.

## Delivered

### 1) Team Authentication
- `GET /auth/login`, `POST /auth/login`, `POST /auth/logout`
- Invite flow:
  - `GET /auth/invite/:token`
  - `POST /auth/invite/:token`
  - `POST /api/auth/invite` (admin-only)
- Roles: `admin`, `editor`, `viewer`
- Local users store: `mission-control/auth/users.json`
- Passwords stored as bcrypt hashes
- Session cookies remain HttpOnly + Secure + expiry
- Login attempt rate limiting for team login

### 2) Task Board Data Layer
- Canonical board file: `mission-control/board/BOARD.json`
- Schema file: `mission-control/board/BOARD.schema.json`
- Board writes validated against schema on every write
- History log (append-only): `mission-control/board/history/YYYY-MM-DD.jsonl`

### 3) Board UI
- Route: `GET /board`
- Kanban columns:
  - Backlog
  - Doing
  - Blocked
  - Ready for Review
  - Done
- Drag/drop between columns (editor/admin)
- Create/Edit task modal with fields:
  - title, owner, due_date, priority (P0–P3), tags, linked_refs, description
- Comment modal per task

### 4) API Endpoints
- `GET /api/board`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `POST /api/tasks/:id/move`
- `POST /api/tasks/:id/comment`
- Extra governance endpoint:
  - `POST /api/tasks/:id/request-approval`
  - `POST /api/tasks/:id/approve` (admin-only)

### 5) Audit
Every write event appends JSONL events to both:
- `mission-control/activity/YYYY-MM-DD.jsonl`
- `mission-control/board/history/YYYY-MM-DD.jsonl`

Event fields include:
- timestamp, actor, action, task_id, before, after

### 6) Dashboard State Integration
`dashboard/state/state.json` now includes:
- `board.counts` by column
- `board.top10` tasks by priority + due date ordering
- `board.last10Activity`

### 7) Governance Controls
- Editors/viewers cannot access `/admin/upload` (admin-only route guard)
- Only admin can approve review packet tasks (`/api/tasks/:id/approve`)
- Request Approval action moves task to Ready for Review and can create a review packet stub link

## Nginx Routing Additions
Added upstream routing to admin service for:
- `/board`
- `/board/`
- `/auth/*`
- `/api/board`
- `/api/tasks*`
- `/api/auth*`

## Deploy / Restart Steps
```bash
cd /home/ec2-user/.openclaw/workspace/admin-server
npm install
node --check src/server.js
sudo systemctl restart uos-admin.service
sudo systemctl is-active uos-admin.service

sudo nginx -t
sudo systemctl reload nginx
sudo systemctl is-active nginx
```

## Verification Quick Test
1. Login as admin: `/admin/login`
2. Generate invite from `/board` (admin button)
3. Accept invite and login via `/auth/login`
4. Create task, move task, comment
5. Request approval (editor/admin) + approve (admin)
6. Confirm JSONL activity logs and board state updates
