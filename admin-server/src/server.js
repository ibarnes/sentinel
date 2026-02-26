import express from 'express';
import session from 'express-session';
import multer from 'multer';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import Ajv from 'ajv';

const app = express();
app.set('trust proxy', 1);

const ROOT = path.resolve('/home/ec2-user/.openclaw/workspace');
const UOS_ROOT = path.join(ROOT, 'workspace', 'uos');
const INBOX_ROOT = path.join(UOS_ROOT, 'inbox');
const CURRENT_ROOT = path.join(UOS_ROOT, 'current');
const ARCHIVE_ROOT = path.join(UOS_ROOT, 'archive');
const UOS_INDEX = path.join(UOS_ROOT, 'UOS_INDEX.md');

const DASHBOARD_STATE_FILE = path.join(ROOT, 'dashboard', 'state', 'state.json');
const DASHBOARD_CHANGELOG = path.join(ROOT, 'dashboard', 'state', 'changelog.md');
const DASHBOARD_SNAPSHOTS = path.join(ROOT, 'dashboard', 'snapshots');

const ADMIN_LOG_ROOT = path.join(ROOT, 'mission-control', 'logs', 'admin-actions');

const TEAM_AUTH_ROOT = path.join(ROOT, 'mission-control', 'auth');
const TEAM_USERS_FILE = path.join(TEAM_AUTH_ROOT, 'users.json');
const BOARD_ROOT = path.join(ROOT, 'mission-control', 'board');
const BOARD_FILE = path.join(BOARD_ROOT, 'BOARD.json');
const BOARD_SCHEMA_FILE = path.join(BOARD_ROOT, 'BOARD.schema.json');
const BOARD_HISTORY_ROOT = path.join(BOARD_ROOT, 'history');
const ACTIVITY_ROOT = path.join(ROOT, 'mission-control', 'activity');
const REVIEW_PACKET_ROOT = path.join(ROOT, 'mission-control', 'review-packets');
const UOS_PENDING_ROOT = path.join(UOS_ROOT, 'pending');

const BOARD_COLUMNS = ['Backlog', 'Doing', 'Blocked', 'Ready for Review', 'Done'];
const BOARD_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
const ARCHITECT_USERNAME = (process.env.ARCHITECT_USERNAME || 'isaac').toLowerCase();

const REQUIRED_FIELDS = ['executionEngine', 'canon', 'revenueOS'];
const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.pdf', '.docx']);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES_PER_CATEGORY = 100;

const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';
const ADMIN_COOKIE_SECURE = String(process.env.ADMIN_COOKIE_SECURE || 'true') === 'true';
const ADMIN_PORT = Number(process.env.ADMIN_PORT || '4180');
const ADMIN_HOST = process.env.ADMIN_HOST || '127.0.0.1';

if (!ADMIN_PASSWORD_HASH || !ADMIN_SESSION_SECRET) {
  console.error('Missing ADMIN_PASSWORD_HASH or ADMIN_SESSION_SECRET env var. Ref: admin-server/.env.example');
  process.exit(1);
}

function uiHead(title) {
  return `
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>
  :root {
    --bg: #0f1115;
    --surface: #151922;
    --surface-elevated: #1a202b;
    --border: #252c39;
    --text: #e8ecf3;
    --text-muted: #9aa5b4;
    --accent: #4f8cff;
    --accent-soft: rgba(79, 140, 255, 0.16);
    --radius-sm: 12px;
    --radius-md: 14px;
    --radius-lg: 16px;
    --shadow-sm: 0 12px 24px rgba(2, 8, 20, 0.18);
    --shadow-lg: 0 20px 44px rgba(2, 8, 20, 0.28);
    --tr-fast: 180ms ease;
  }

  html, body { background: var(--bg); color: var(--text); font-family: Inter, "Segoe UI", Roboto, sans-serif; }
  body { min-height: 100vh; }
  a { color: #86b2ff; text-decoration: none; }
  a:hover { color: #a3c6ff; }
  .app-shell { max-width: 1380px; margin: 24px auto; padding: 0 16px; }
  .page-title { font-size: 1.65rem; font-weight: 650; margin: 0; letter-spacing: -0.02em; }
  .section-title { font-size: 1rem; font-weight: 600; margin: 0; }
  .text-muted { color: var(--text-muted) !important; }

  .surface-card,
  .card,
  .navbar,
  .form-control,
  .form-select,
  .table,
  .list-group-item,
  .dropdown-menu {
    background: var(--surface) !important;
    color: var(--text);
    border-color: var(--border) !important;
  }

  .card,
  .navbar,
  .form-control,
  .form-select,
  .btn,
  .table,
  .dropdown-menu {
    border-radius: var(--radius-md) !important;
  }

  .card,
  .navbar { box-shadow: var(--shadow-sm); }
  .card.elevated { box-shadow: var(--shadow-lg); background: var(--surface-elevated) !important; }

  .form-control,
  .form-select {
    min-height: 40px;
    color: var(--text);
  }
  .form-control::placeholder { color: #7f8998; }
  .form-control:focus,
  .form-select:focus,
  .btn:focus,
  .nav-link:focus {
    box-shadow: 0 0 0 3px var(--accent-soft) !important;
    border-color: var(--accent) !important;
    outline: none;
  }

  .btn { transition: all var(--tr-fast); min-height: 38px; }
  .btn-primary {
    background: var(--accent);
    border-color: var(--accent);
    color: #f8fbff;
  }
  .btn-primary:hover { background: #669bff; border-color: #669bff; }
  .btn-outline-secondary,
  .btn-outline-primary {
    border-color: var(--border);
    color: var(--text);
  }
  .btn-outline-secondary:hover,
  .btn-outline-primary:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: #394457;
    color: var(--text);
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid transparent;
    color: var(--text-muted);
  }
  .btn-ghost:hover { color: var(--text); background: rgba(255,255,255,.04); }

  .metric-card { min-height: 126px; }
  .metric-label { color: var(--text-muted); font-size: .78rem; font-weight: 500; text-transform: uppercase; letter-spacing: .06em; }
  .metric-value { font-size: 1.9rem; line-height: 1.05; font-weight: 680; letter-spacing: -0.02em; }

  .table { --bs-table-bg: transparent; --bs-table-color: var(--text); margin-bottom: 0; }
  .table thead th {
    background: rgba(255,255,255,.03);
    color: #c7d1df;
    border-bottom: 1px solid var(--border);
    font-size: .76rem;
    text-transform: uppercase;
    letter-spacing: .05em;
    font-weight: 600;
    padding: .85rem .9rem;
  }
  .table td {
    border-color: rgba(255,255,255,.06);
    padding: .82rem .9rem;
    vertical-align: middle;
  }
  .table tbody tr:nth-child(even) { background: rgba(255,255,255,.015); }
  .table tbody tr { transition: background var(--tr-fast); }
  .table tbody tr:hover { background: rgba(79,140,255,.09); }

  .mono { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; }
  .dropzone { border: 2px dashed var(--bs-border-color); border-radius: .75rem; padding: .9rem; background: var(--bs-tertiary-bg); }
  .dropzone.dragover { border-color: var(--bs-primary); background: color-mix(in srgb, var(--bs-primary) 8%, white); }

  .panel-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
  .panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }

  /* Studio button/layout polish */
  .studio-actions { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; }
  .studio-actions .btn { min-height:40px; }
  .studio-editor-actions { display:flex; flex-wrap:wrap; gap:.5rem; align-items:flex-end; justify-content:flex-end; }
  .studio-editor-actions .btn { min-height:40px; }
  @media (max-width: 768px) {
    .studio-actions, .studio-editor-actions { flex-direction:column; align-items:stretch; }
    .studio-actions .btn, .studio-editor-actions .btn { width:100%; }
  }

  /* SaaS sidebar navigation */
  .app-shell { --sidebar-w: 252px; }

  .oc-nav {
    position: fixed;
    top: 24px;
    left: max(16px, calc((100vw - 1380px) / 2 + 16px));
    z-index: 20;
    width: var(--sidebar-w);
    max-height: calc(100vh - 48px);
    overflow: auto;
    scrollbar-gutter: stable;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: var(--surface-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 14px;
    box-shadow: var(--shadow-sm);
  }
  .app-shell > .oc-nav ~ * {
    margin-left: calc(var(--sidebar-w) + 28px);
    min-width: 0;
  }
  .oc-nav-title {
    font-size: .96rem;
    font-weight: 650;
    letter-spacing: .01em;
    color: var(--text);
    padding: 4px 6px 10px;
    border-bottom: 1px solid rgba(255,255,255,.06);
  }
  .oc-nav-links { display: grid; gap: 4px; }
  .oc-nav .nav-link {
    color: var(--text-muted);
    border-radius: 10px;
    padding: .54rem .66rem;
    line-height: 1.25;
    transition: all var(--tr-fast);
    border: 1px solid transparent;
  }
  .oc-nav .nav-link:hover { color: var(--text); background: rgba(255,255,255,.045); }
  .oc-nav .nav-link.active {
    color: #f4f8ff;
    background: var(--accent-soft);
    border-color: rgba(79, 140, 255, .45);
  }
  .oc-nav-footer { margin-top: auto; display: grid; gap: 8px; }
  .oc-nav-footer .btn { width: 100%; justify-content: center; }

  @media (max-width: 992px) {
    .app-shell { padding: 0 12px; }
    .app-shell > .oc-nav ~ * { margin-left: 0; }
    .oc-nav {
      position: static;
      width: auto;
      max-height: none;
      overflow: visible;
      margin-bottom: 12px;
      padding: 12px;
    }
    .oc-nav-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
  }
  @media (max-width: 640px) {
    .oc-nav-links { grid-template-columns: 1fr; }
  }
</style>`;
}

function adminNav(active = '') {
  const is = (k) => active === k ? 'active' : '';
  return `<nav class="oc-nav" aria-label="Admin navigation">
    <a class="oc-nav-title" href="/admin">Sentinel Admin</a>
    <div class="oc-nav-links">
      <a class="nav-link ${is('panel')}" href="/admin">Panel</a>
      <a class="nav-link ${is('upload')}" href="/admin/upload">Upload</a>
      <a class="nav-link ${is('dashboard')}" href="/dashboard/">Dashboard</a>
      <a class="nav-link ${is('buyers')}" href="/dashboard/buyers">Buyers</a>
      <a class="nav-link ${is('initiatives')}" href="/dashboard/initiatives">Initiatives</a>
      <a class="nav-link ${is('activity')}" href="/dashboard/activity">Activity</a>
      <a class="nav-link ${is('review')}" href="/dashboard/review">Review</a>
      <a class="nav-link ${is('board')}" href="/dashboard/board">Board</a>
      <a class="nav-link ${is('uos')}" href="/dashboard/uos">UOS</a>
    </div>
    <form method="post" action="/admin/logout" class="oc-nav-footer m-0">
      <button class="btn btn-sm btn-outline-secondary logout-btn" type="submit">Logout</button>
    </form>
  </nav>`;
}

function dashboardNav(active = '') {
  const is = (k) => active === k ? 'active' : '';
  return `<nav class="oc-nav" aria-label="Dashboard navigation">
    <a class="oc-nav-title" href="/dashboard/">UOS Dashboard</a>
    <div class="oc-nav-links">
      <a class="nav-link ${is('home')}" href="/dashboard/">Home</a>
      <a class="nav-link ${is('buyers')}" href="/dashboard/buyers">Buyers</a>
      <a class="nav-link ${is('initiatives')}" href="/dashboard/initiatives">Initiatives</a>
      <a class="nav-link ${is('activity')}" href="/dashboard/activity">Activity</a>
      <a class="nav-link ${is('review')}" href="/dashboard/review">Review</a>
      <a class="nav-link ${is('board')}" href="/dashboard/board">Board</a>
      <a class="nav-link ${is('uos')}" href="/dashboard/uos">UOS</a>
      <a class="nav-link ${is('studio')}" href="/dashboard/presentation-studio">Presentation Studio</a>
    </div>
    <div class="oc-nav-footer">
      <a class="btn btn-sm btn-outline-secondary team-btn" href="/board">Team Board</a>
    </div>
  </nav>`;
}

function pageHeader(title, actions = '', meta = '') {
  return `<div class="panel-header">
    <div>
      <h1 class="page-title">${title}</h1>
      ${meta ? `<div class="small text-muted mt-1">${meta}</div>` : ''}
    </div>
    ${actions ? `<div class="panel-actions">${actions}</div>` : ''}
  </div>`;
}

function statCard(label, value, meta = '') {
  return `<div class="card metric-card"><div class="card-body d-flex flex-column justify-content-between">
    <div class="metric-label">${label}</div>
    <div class="metric-value">${value}</div>
    ${meta ? `<div class="small text-muted mono">${meta}</div>` : ''}
  </div></div>`;
}

function tableShell(headers, rows, emptyRow = '', colspan = headers.length) {
  const content = rows.length ? rows.join('') : `<tr><td colspan="${colspan}" class="text-muted">${emptyRow || 'No rows'}</td></tr>`;
  return `<div class="card"><div class="table-responsive"><table class="table table-sm align-middle">
    <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${content}</tbody>
  </table></div></div>`;
}

async function ensureDirs() {
  const dirs = [
    INBOX_ROOT,
    CURRENT_ROOT,
    ARCHIVE_ROOT,
    path.dirname(DASHBOARD_STATE_FILE),
    DASHBOARD_SNAPSHOTS,
    ADMIN_LOG_ROOT,
    TEAM_AUTH_ROOT,
    BOARD_ROOT,
    BOARD_HISTORY_ROOT,
    ACTIVITY_ROOT,
    REVIEW_PACKET_ROOT,
    UOS_PENDING_ROOT
  ];
  await Promise.all(dirs.map((d) => fs.mkdir(d, { recursive: true })));
}

function nowIso() {
  return new Date().toISOString();
}

function dateOnly() {
  return nowIso().slice(0, 10);
}

function tsForPath() {
  return nowIso().replace(/[:.]/g, '-');
}

function safeName(name) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function ext(name) {
  return path.extname(name || '').toLowerCase();
}

function base(name) {
  return path.basename(name || '', path.extname(name || ''));
}

function currentUser(req) {
  return req.session?.user || null;
}

function requireAdminAuth(req, res, next) {
  const u = currentUser(req);
  if (u?.scope === 'admin') return next();
  return res.redirect('/admin/login');
}

function requireTeamAuth(req, res, next) {
  const u = currentUser(req);
  if (u?.scope === 'team') return next();
  return res.redirect('/auth/login');
}

function requireAnyAuth(req, res, next) {
  const u = currentUser(req);
  if (u) return next();
  return res.redirect('/auth/login');
}

function normalizedRole(role) {
  if (role === 'admin') return 'architect';
  if (role === 'viewer') return 'observer';
  return role;
}

function effectiveRole(req) {
  const u = currentUser(req);
  if (!u) return null;
  if (u.scope === 'admin') return 'architect';
  return normalizedRole(u.role);
}

function isArchitect(req) {
  const u = currentUser(req);
  if (!u) return false;
  if (u.scope === 'admin') return true;
  return normalizedRole(u.role) === 'architect' || String(u.username || '').toLowerCase() === ARCHITECT_USERNAME;
}

function requireRole(...roles) {
  return (req, res, next) => {
    const r = effectiveRole(req);
    if (!r || !roles.includes(r)) {
      appendAuditEvent({
        ts: nowIso(),
        actor: getUserLabel(req),
        role: r || 'anonymous',
        event_type: 'permission.denied',
        entity_type: 'route',
        entity_id: req.originalUrl,
        meta: { required_roles: roles }
      }).catch(() => {});
      return res.status(403).json({ error: 'forbidden' });
    }
    return next();
  };
}

const loginAttempts = new Map(); // ip -> { count, firstTs }
const MAX_LOGIN_ATTEMPTS = 7;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function loginRateLimit(req, res, next) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const row = loginAttempts.get(ip);

  if (!row) {
    loginAttempts.set(ip, { count: 1, firstTs: now });
    return next();
  }

  if (now - row.firstTs > ATTEMPT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstTs: now });
    return next();
  }

  if (row.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).send('Too many login attempts. Try again later.');
  }

  row.count += 1;
  loginAttempts.set(ip, row);
  return next();
}

function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(
  session({
    name: 'uos_admin_session',
    secret: ADMIN_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: ADMIN_COOKIE_SECURE,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use('/dashboard', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method not allowed');
  }
  return next();
});

app.get(['/dashboard', '/dashboard/'], async (_req, res) => {
  const state = await readJson(DASHBOARD_STATE_FILE, {});
  const boardCounts = state.board?.counts || {};
  const pendingRps = state.pendingReviewPackets ?? 0;
  const latestUosPublish = state.latestUosPublish || 'N/A';
  const recent = await readActivityEvents({ limit: 20 });

  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Dashboard')}</head><body>
  <div class="app-shell">
    ${dashboardNav('home')}
    ${pageHeader('Operations Dashboard', `
      <a class="btn btn-outline-secondary btn-sm" href="/dashboard/activity">Activity</a>
      <a class="btn btn-outline-secondary btn-sm" href="/dashboard/review">Review Packets</a>
      <a class="btn btn-primary btn-sm" href="/dashboard/board">Board</a>
    `, 'Mission Control overview')}

    <div class="row g-3 mb-3">
      <div class="col-12 col-md-6 col-xl-3">${statCard('Active Tasks', Object.values(boardCounts).reduce((a,b)=>a+Number(b||0),0))}</div>
      <div class="col-12 col-md-6 col-xl-3">${statCard('Pending Review Packets', pendingRps)}</div>
      <div class="col-12 col-md-6 col-xl-3">${statCard('Latest UOS Publish', '-', escapeHtml(latestUosPublish))}</div>
      <div class="col-12 col-md-6 col-xl-3">${statCard('Last Updated', '-', escapeHtml(state.lastUpdated || 'N/A'))}</div>
    </div>

    ${tableShell(
      ['Time', 'Actor', 'Event', 'Entity'],
      recent.map(e => `<tr><td class="mono small">${escapeHtml(e.ts || '')}</td><td>${escapeHtml(e.actor || '')}</td><td>${escapeHtml(e.event_type || '')}</td><td>${escapeHtml((e.entity_type || '') + ':' + (e.entity_id || ''))}</td></tr>`),
      'No activity yet'
    )}
  </div>
</body></html>`);
});

app.get('/dashboard/activity', async (req, res) => {
  const actor = req.query.actor ? String(req.query.actor) : undefined;
  const entity_type = req.query.entity_type ? String(req.query.entity_type) : undefined;
  const date = req.query.date ? String(req.query.date) : undefined;
  const events = await readActivityEvents({ limit: 1000, actor, entity_type, date, maxScan: 1000 });
  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard Activity')}</head><body><div class="app-shell">
    ${dashboardNav('activity')}
    ${pageHeader('Activity Feed')}
    <form class="row g-2 mb-3" method="get" action="/dashboard/activity">
      <div class="col"><input class="form-control" name="actor" placeholder="actor" value="${escapeHtml(actor || '')}"></div>
      <div class="col"><input class="form-control" name="entity_type" placeholder="entity_type" value="${escapeHtml(entity_type || '')}"></div>
      <div class="col"><input class="form-control" name="date" placeholder="YYYY-MM-DD" value="${escapeHtml(date || '')}"></div>
      <div class="col-auto"><button class="btn btn-primary" type="submit">Filter</button></div>
    </form>
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>ts</th><th>actor</th><th>role</th><th>event_type</th><th>entity</th><th>meta</th></tr></thead><tbody>
      ${(events.map(e => `<tr><td class="mono small">${escapeHtml(e.ts||'')}</td><td>${escapeHtml(e.actor||'')}</td><td>${escapeHtml(e.role||'')}</td><td>${escapeHtml(e.event_type||'')}</td><td>${escapeHtml((e.entity_type||'')+':' + (e.entity_id||''))}</td><td><code>${escapeHtml(JSON.stringify(e.meta||{}))}</code></td></tr>`).join('')) || '<tr><td colspan="6">No events</td></tr>'}
    </tbody></table></div>
  </div></body></html>`);
});

app.get('/dashboard/review', async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const showAll = String(req.query.showAll || 'false') === 'true';
  const pageSizeRaw = Number.parseInt(String(req.query.pageSize || '25'), 10) || 25;

  const all = await listReviewPackets(5000);
  const pageSize = showAll ? Math.max(1, all.length) : Math.min(100, Math.max(10, pageSizeRaw));
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;
  const rps = all.slice(start, end);

  const qp = (p) => `/dashboard/review?page=${p}&pageSize=${pageSize}`;

  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard Review Packets')}</head><body><div class="app-shell">
    ${dashboardNav('review')}
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h1 class="page-title">Review Packets</h1>
      <div class="small text-muted">Total: ${total} • Page ${safePage}/${totalPages}</div>
    </div>
    <div class="d-flex gap-2 mb-2">
      <a class="btn btn-sm btn-outline-secondary" href="/dashboard/review?showAll=true">Show All</a>
      <a class="btn btn-sm btn-outline-secondary" href="/dashboard/review?page=1&pageSize=25">Paged View</a>
    </div>
    <div class="card"><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Linked Task</th><th>Created</th><th>By</th><th>File</th></tr></thead><tbody>
      ${(rps.map(r => `<tr><td>${escapeHtml(r.rp_id||'')}</td><td>${escapeHtml(r.title||'')}</td><td>${escapeHtml(r.status||'')}</td><td>${escapeHtml(r.linked_task||'')}</td><td class="mono small">${escapeHtml(r.created_at||'')}</td><td>${escapeHtml(r.created_by||'')}</td><td class="mono small">${escapeHtml(r.path||'')}</td></tr>`).join('')) || '<tr><td colspan="7">No review packets</td></tr>'}
    </tbody></table></div></div>

    <div class="d-flex flex-wrap gap-2 align-items-center mt-2">
      <a class="btn btn-sm btn-outline-secondary ${safePage <= 1 ? 'disabled' : ''}" href="${safePage <= 1 ? '#' : qp(1)}">« First</a>
      <a class="btn btn-sm btn-outline-secondary ${safePage <= 1 ? 'disabled' : ''}" href="${safePage <= 1 ? '#' : qp(safePage - 1)}">‹ Prev</a>
      <a class="btn btn-sm btn-outline-secondary ${safePage >= totalPages ? 'disabled' : ''}" href="${safePage >= totalPages ? '#' : qp(safePage + 1)}">Next ›</a>
      <a class="btn btn-sm btn-outline-secondary ${safePage >= totalPages ? 'disabled' : ''}" href="${safePage >= totalPages ? '#' : qp(totalPages)}">Last »</a>
      <form class="d-flex gap-2 ms-auto" method="get" action="/dashboard/review">
        <input type="hidden" name="pageSize" value="${pageSize}" />
        <input class="form-control form-control-sm" style="width:90px" type="number" min="1" max="${totalPages}" name="page" value="${safePage}" />
        <button class="btn btn-sm btn-primary" type="submit">Go</button>
      </form>
    </div>
  </div></body></html>`);
});

app.get('/dashboard/board', async (_req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const counts = Object.fromEntries(BOARD_COLUMNS.map(c => [c, board.tasks.filter(t => t.status===c).length]));
  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard Board')}</head><body><div class="app-shell">
    ${dashboardNav('board')}
    ${pageHeader('Board Snapshot')}
    <div class="row g-3 mb-3">${BOARD_COLUMNS.map(c=>`<div class="col-12 col-md-6 col-xl">${statCard(c, counts[c])}</div>`).join('')}</div>
    <a class="btn btn-primary" href="/board">Open Board UI</a>
  </div></body></html>`);
});

app.get('/dashboard/uos', async (_req, res) => {
  const state = await readJson(DASHBOARD_STATE_FILE, {});
  const idxPath = path.join(UOS_ROOT, 'UOS_INDEX.md');
  const indexTxt = await fs.readFile(idxPath, 'utf8').catch(() => 'UOS index not found.');

  let currentFiles = [];
  for (const key of ['execution-engine', 'canon', 'revenue-os']) {
    const dir = path.join(CURRENT_ROOT, key);
    if (fssync.existsSync(dir)) {
      const files = await fs.readdir(dir);
      currentFiles.push(...files.filter(f => f.endsWith('.md')).map(f => `${key}/${f}`));
    }
  }

  const pendingRoot = path.join(UOS_ROOT, 'pending');
  const pendingBatches = (await fs.readdir(pendingRoot).catch(() => [])).sort().reverse();

  res.type('html').send(`<!doctype html><html><head>${uiHead('Dashboard UOS')}</head><body><div class="app-shell">
    ${dashboardNav('uos')}
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h1 class="page-title">UOS Documents</h1>
      <a class="btn btn-sm btn-primary" href="/admin/upload">Upload UOS Documents</a>
    </div>
    <div class="row g-3 mb-3">
      <div class="col-12 col-lg-6"><div class="card"><div class="card-body">
        <h6>Latest Publish</h6>
        <p class="mb-1"><strong>Timestamp:</strong> ${escapeHtml(state.latestUosPublish || 'N/A')}</p>
        <p class="mb-1"><strong>Batch:</strong> ${escapeHtml(state.latestUosPublishedBatch || 'N/A')}</p>
        <p class="mb-0"><strong>Current docs:</strong> ${currentFiles.length}</p>
      </div></div></div>
      <div class="col-12 col-lg-6"><div class="card"><div class="card-body">
        <h6>Pending Batches</h6>
        <ul class="mb-0">${pendingBatches.slice(0,20).map(b => `<li class="mono small">${escapeHtml(b)}</li>`).join('') || '<li>None</li>'}</ul>
      </div></div></div>
    </div>

    <div class="card mb-3"><div class="card-body">
      <h6>Current UOS Markdown Files</h6>
      <ul>${currentFiles.map(f => `<li class="mono small">${escapeHtml(f)}</li>`).join('') || '<li>No current files</li>'}</ul>
    </div></div>

    <div class="card"><div class="card-body">
      <h6>UOS Index</h6>
      <pre class="small" style="max-height:45vh;overflow:auto">${escapeHtml(indexTxt)}</pre>
    </div></div>
  </div></body></html>`);
});

app.get('/dashboard/buyers', async (req, res) => {
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const sector = req.query.sector ? String(req.query.sector) : '';
  const filtered = buyers.filter(b => !sector || (b.sector_focus || []).includes(sector))
    .sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  const sectors = [...new Set(buyers.flatMap(b=>b.sector_focus||[]))].sort();
  const canEdit = ['architect','editor'].includes(effectiveRole(req) || '');
  res.type('html').send(`<!doctype html><html><head>${uiHead('Buyers')}</head><body><div class="app-shell">
    ${dashboardNav('buyers')}
    <div class="d-flex justify-content-between align-items-center mb-2"><h1 class="page-title">Buyers</h1>${canEdit ? '<button class="btn btn-sm btn-primary" data-bs-toggle="collapse" data-bs-target="#addBuyerBox">Add Buyer</button>' : ''}</div>
    ${canEdit ? `<div id="addBuyerBox" class="collapse mb-3"><div class="card"><div class="card-body">
      <h6>Add Buyer</h6>
      <form method="post" action="/api/buyers" class="row g-2">
        <div class="col-md-3"><input class="form-control" name="buyer_id" placeholder="Buyer ID (e.g., PIF)" required></div>
        <div class="col-md-5"><input class="form-control" name="name" placeholder="Buyer name" required></div>
        <div class="col-md-2"><input class="form-control" name="type" placeholder="Type" value="Sovereign"></div>
        <div class="col-md-2"><input class="form-control" name="score" placeholder="Score" value="1.0"></div>
        <div class="col-12"><textarea class="form-control" name="mandate_summary" rows="2" placeholder="Mandate summary"></textarea></div>
        <div class="col-md-6"><input class="form-control" name="geo_focus" placeholder="Geo focus (comma separated)"></div>
        <div class="col-md-6"><input class="form-control" name="sector_focus" placeholder="Sector focus (comma separated)"></div>
        <div class="col-12"><button class="btn btn-primary" type="submit">Save Buyer</button></div>
      </form>
    </div></div></div>` : ''}
    <form class="row g-2 mb-3"><div class="col-4"><select class="form-select" name="sector"><option value="">All sectors</option>${sectors.map(s=>`<option ${s===sector?'selected':''}>${s}</option>`).join('')}</select></div><div class="col-auto"><button class="btn btn-primary">Filter</button></div></form>
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Buyer</th><th>Type</th><th>Score</th><th>Sectors</th></tr></thead><tbody>${filtered.map(b=>`<tr><td><a href="/dashboard/buyer/${encodeURIComponent(b.buyer_id)}">${escapeHtml(b.name)}</a></td><td>${escapeHtml(b.type||'')}</td><td>${b.score ?? ''}</td><td>${escapeHtml((b.sector_focus||[]).join(', '))}</td></tr>`).join('')}</tbody></table></div>

    ${canEdit ? `<div class="card mt-3"><div class="card-body">
      <h6>Initiative Idea Builder (UOS-grounded)</h6>
      <div class="row g-2">
        <div class="col-md-4"><label class="form-label">Buyer</label><select id="ideaBuyer" class="form-select">${buyers.map(b=>`<option value="${escapeHtml(b.buyer_id)}">${escapeHtml(b.buyer_id)} — ${escapeHtml(b.name)}</option>`).join('')}</select></div>
        <div class="col-md-6"><label class="form-label">Prompt (optional)</label><input id="ideaPrompt" class="form-control" placeholder="e.g., focus on West Africa, pre-FID, risk-compression" /></div>
        <div class="col-md-2 d-flex align-items-end"><button id="genIdeasBtn" class="btn btn-primary w-100" type="button">Suggest Initiatives</button></div>
      </div>
      <div id="ideaResults" class="mt-3"></div>
    </div></div>` : ''}
  </div>
  ${canEdit ? `<script>
    async function createInitiative(payload){
      const r = await fetch('/api/initiatives', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      if(!r.ok){ const t=await r.text(); alert('Create failed: '+t); return; }
      const j=await r.json();
      window.location.href = '/dashboard/initiative/' + encodeURIComponent(j.initiative_id) + '?buyer_id=' + encodeURIComponent(payload.linked_buyers?.[0] || '');
    }

    document.getElementById('genIdeasBtn')?.addEventListener('click', async () => {
      const buyer_id = document.getElementById('ideaBuyer').value;
      const prompt = document.getElementById('ideaPrompt').value || '';
      const r = await fetch('/api/initiatives/suggest', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ buyer_id, prompt, count: 5 })});
      const box = document.getElementById('ideaResults');
      if(!r.ok){ box.innerHTML = '<div class="text-danger">Suggestion failed.</div>'; return; }
      const j = await r.json();
      const ideas = j.ideas || [];
      if(!ideas.length){ box.innerHTML = '<div class="text-muted">No suggestions.</div>'; return; }
      box.innerHTML = ideas.map((x,i)=>{
        return '<div class="card mb-2"><div class="card-body">' +
          '<div class="d-flex justify-content-between align-items-center"><strong>' + x.name + '</strong><button class="btn btn-sm btn-success" data-idx="' + i + '">Use this</button></div>' +
          '<div class="small text-muted">Status: ' + x.status + '</div>' +
          '<div class="small">' + x.macro_gravity_summary + '</div>' +
        '</div></div>';
      }).join('');
      box.querySelectorAll('button[data-idx]').forEach(btn => btn.addEventListener('click', () => createInitiative(ideas[Number(btn.dataset.idx)])));
    });
  </script>` : ''}
</body></html>`);
});

app.get('/dashboard/initiatives', async (_req, res) => {
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const byId = Object.fromEntries(buyers.map(b => [b.buyer_id, b.name]));
  const sorted = [...initiatives].sort((a,b)=>String(a.initiative_id).localeCompare(String(b.initiative_id)));
  res.type('html').send(`<!doctype html><html><head>${uiHead('Initiatives')}</head><body><div class="app-shell">
    ${dashboardNav('initiatives')}
    ${pageHeader('Initiatives')}
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>ID</th><th>Name</th><th>Status</th><th>Linked Buyers</th></tr></thead><tbody>
      ${sorted.map(i=>`<tr><td><a href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}">${escapeHtml(i.initiative_id)}</a></td><td>${escapeHtml(i.name || '')}</td><td>${escapeHtml(i.status || '')}</td><td>${escapeHtml((i.linked_buyers || []).map(b=>byId[b]||b).join(', '))}</td></tr>`).join('') || '<tr><td colspan="4">No initiatives</td></tr>'}
    </tbody></table></div>
  </div></body></html>`);
});

app.get('/dashboard/buyer/:id', async (req, res) => {
  const id = String(req.params.id);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const b = buyers.find(x=>x.buyer_id===id);
  if(!b) return res.status(404).send('Buyer not found');
  const linked = initiatives.filter(i => (b.initiatives||[]).includes(i.initiative_id));
  res.type('html').send(`<!doctype html><html><head>${uiHead('Buyer Detail')}</head><body><div class="app-shell">
    ${dashboardNav('buyers')}
    <a class="btn btn-sm btn-outline-secondary mb-2" href="/dashboard/buyers">← Buyers</a>
    <h3>${escapeHtml(b.name)}</h3>
    <p>${escapeHtml(b.mandate_summary || '')}</p>
    <ul><li><strong>Score:</strong> ${b.score ?? ''}</li><li><strong>Geo:</strong> ${escapeHtml((b.geo_focus||[]).join(', '))}</li><li><strong>Sectors:</strong> ${escapeHtml((b.sector_focus||[]).join(', '))}</li></ul>
    <h5>Linked Initiatives</h5>
    <ul>${linked.map(i=>`<li><a href="/dashboard/initiative/${encodeURIComponent(i.initiative_id)}?buyer_id=${encodeURIComponent(b.buyer_id)}">${escapeHtml(i.name)}</a></li>`).join('') || '<li>None</li>'}</ul>
  </div></body></html>`);
});

app.get('/dashboard/initiative/:id', async (req, res) => {
  const id = String(req.params.id);
  const buyer_id = req.query.buyer_id ? String(req.query.buyer_id) : '';
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const i = initiatives.find(x=>x.initiative_id===id);
  if(!i) return res.status(404).send('Initiative not found');
  const linkedBuyers = buyers.filter(b => (i.linked_buyers||[]).includes(b.buyer_id));
  const decksRoot = path.join(ROOT, 'presentations', id, 'decks');
  const deckLinks = [];
  if (fssync.existsSync(decksRoot)) {
    const walk=(d)=>{ for(const e of fssync.readdirSync(d,{withFileTypes:true})){ const p=path.join(d,e.name); if(e.isDirectory()) walk(p); else if(e.name==='index.html') deckLinks.push(path.relative(ROOT,p)); }};
    walk(decksRoot);
  }
  res.type('html').send(`<!doctype html><html><head>${uiHead('Initiative Detail')}</head><body><div class="app-shell">
    ${dashboardNav('buyers')}
    <a class="btn btn-sm btn-outline-secondary mb-2" href="/dashboard/buyers">← Buyers</a>
    <h3>${escapeHtml(i.name)}</h3>
    <p>${escapeHtml(i.macro_gravity_summary || '')}</p>
    <p><strong>Status:</strong> ${escapeHtml(i.status || '')}</p>
    <h5>Linked Buyers</h5><ul>${linkedBuyers.map(b=>`<li>${escapeHtml(b.name)}</li>`).join('')}</ul>
    <div class="card"><div class="card-body">
      <h5>Create Presentation</h5>
      <form method="post" action="/api/presentations/generate" class="row g-2">
        <input type="hidden" name="initiative_id" value="${escapeHtml(i.initiative_id)}" />
        <div class="col-md-3"><label class="form-label">Type</label><select class="form-select" name="deck_type"><option value="utc-internal">UTC Internal</option><option value="buyer-mandate-mirror">Buyer Mandate Mirror</option></select></div>
        <div class="col-md-3"><label class="form-label">Template</label><select class="form-select" name="template_id"><option>sovereign-memo</option><option>clean-minimal</option><option>blueprint</option><option>dark-institutional</option></select></div>
        <div class="col-md-3"><label class="form-label">Image Provider</label><select class="form-select" name="image_provider"><option value="placeholder">Placeholder</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="grok">Grok (xAI)</option></select></div>
        <div class="col-md-3"><label class="form-label">Copy Provider</label><select class="form-select" name="copy_provider"><option value="local">Local Rewriter</option><option value="claude">Claude (Anthropic)</option></select></div>
        <div class="col-md-3"><label class="form-label">Buyer (for mirror)</label><select class="form-select" name="buyer_id"><option value="">(none)</option>${linkedBuyers.map(b=>`<option ${b.buyer_id===buyer_id?'selected':''} value="${b.buyer_id}">${escapeHtml(b.buyer_id)}</option>`).join('')}</select></div>
        <div class="col-12"><small class="text-muted">Reading level is locked to 8–9th grade.</small></div>
        <div class="col-12"><button class="btn btn-primary">Generate</button></div>
      </form>
    </div></div>
    <h5 class="mt-3">Decks</h5>
    <ul>${deckLinks.map(p=>`<li><a href="/${p}">${escapeHtml(p)}</a></li>`).join('') || '<li>No decks yet</li>'}</ul>
  </div></body></html>`);
});

app.get('/api/presentations/whoami', requireAnyAuth, async (req, res) => {
  res.json({ user: currentUser(req), effectiveRole: effectiveRole(req) });
});

app.post('/api/presentations/export', requireRole('architect','editor','observer'), async (req, res) => {
  const deck = String(req.body.deck || '');
  const format = String(req.body.format || 'both');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', [path.join(ROOT,'scripts/export_deck.js'), '--deck', deck, '--format', format], { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).send(`export failed: ${r.stderr || r.stdout}`);
  return res.type('application/json').send(r.stdout || '{}');
});

app.get('/dashboard/presentation-studio', requireAnyAuth, async (req, res) => {
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiative_id = String(req.query.initiative_id || initiatives[0]?.initiative_id || '');
  const buyer_id = String(req.query.buyer_id || '');

  const optsInitiatives = initiatives.map(i => `<option value="${i.initiative_id}" ${i.initiative_id===initiative_id?'selected':''}>${escapeHtml(i.initiative_id)} — ${escapeHtml(i.name)}</option>`).join('');
  const optsBuyers = ['<option value="">(none)</option>', ...buyers.map(b => `<option value="${b.buyer_id}" ${b.buyer_id===buyer_id?'selected':''}>${escapeHtml(b.buyer_id)} — ${escapeHtml(b.name)}</option>` )].join('');

  res.type('html').send(`<!doctype html><html><head>${uiHead('Presentation Studio')}</head><body>
  <div class="app-shell" style="max-width:1400px">
    ${dashboardNav('studio')}
    <div class="row g-3">
      <div class="col-12 col-lg-4">
        <div class="card shadow-sm"><div class="card-body">
          <h5>Prompt + Generate</h5>
          <form id="studioForm" class="vstack gap-2">
            <label class="form-label">Initiative</label>
            <select class="form-select" name="initiative_id">${optsInitiatives}</select>
            <label class="form-label">Buyer (optional)</label>
            <select class="form-select" name="buyer_id">${optsBuyers}</select>
            <label class="form-label">Deck Type</label>
            <select class="form-select" name="deck_type"><option value="utc-internal">UTC Internal</option><option value="buyer-mandate-mirror">Buyer Mandate Mirror</option></select>
            <label class="form-label">Template</label>
            <select class="form-select" name="template_id"><option>sovereign-memo</option><option>clean-minimal</option><option>blueprint</option><option>dark-institutional</option></select>
            <label class="form-label">Image Provider</label>
            <select class="form-select" name="image_provider"><option value="placeholder">Placeholder</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="grok">Grok (xAI)</option></select>
            <label class="form-label">Copy Provider</label>
            <select class="form-select" name="copy_provider"><option value="local">Local Rewriter</option><option value="claude">Claude</option></select>
            <label class="form-label">Prompt</label>
            <textarea class="form-control" rows="8" name="prompt" placeholder="Tell Sentinel what to change in this deck..."></textarea>
            <div class="studio-actions">
              <button class="btn btn-primary" type="button" id="btnGenerate">Generate from Prompt</button>
              <button class="btn btn-outline-primary" type="button" id="btnAuto">Generate for Me</button>
            </div>
            <small class="text-muted">Slides are HTML + CSS. Prompt updates slide content and regenerates preview.</small>
          </form>
        </div></div>
      </div>
      <div class="col-12 col-lg-8">
        <div class="card shadow-sm"><div class="card-body">
          <div class="d-flex justify-content-between align-items-center"><h5 class="mb-0">Slides Preview</h5><a id="openDeck" class="btn btn-sm btn-outline-secondary" target="_blank" href="#">Open Deck</a></div>
          <div id="slideList" class="small text-muted my-2">No deck generated yet.</div>
          <div class="row g-2 mb-2" id="thumbRow"></div>
          <iframe id="deckFrame" style="width:100%;height:44vh;border:1px solid #ddd;border-radius:8px"></iframe>

          <div class="card mt-2"><div class="card-body">
            <h6 class="mb-2">Slide Editor v1 (SlideSpec source)</h6>
            <div class="row g-2">
              <div class="col-md-2"><label class="form-label">Slide</label><select id="editSlideId" class="form-select"></select></div>
              <div class="col-md-4"><label class="form-label">Layout</label><select id="editLayout" class="form-select"><option>title</option><option>section</option><option>proof</option><option>diagram</option><option>close</option></select></div>
              <div class="col-md-6"><label class="form-label">Title</label><input id="editTitle" class="form-control" /></div>
              <div class="col-12"><label class="form-label">Bullets (one per line)</label><textarea id="editBullets" rows="5" class="form-control"></textarea></div>
              <div class="col-md-8"><label class="form-label">Image prompt (slot 1)</label><input id="editImagePrompt" class="form-control" /></div>
              <div class="col-md-4 studio-editor-actions">
                <button id="saveSlideBtn" class="btn btn-primary" type="button">Save + Re-render Slide</button>
                <button id="regenImageBtn" class="btn btn-outline-secondary" type="button">Regen Image</button>
                <button id="deleteSlideBtn" class="btn btn-outline-danger" type="button">Delete Slide</button>
              </div>
            </div>
          </div></div>
        </div></div>
      </div>
    </div>
  </div>
  <script>
    let lastDeckPath = '';
    let lastDeckRoot = '';
    let deckSpec = null;
    let selectedSlide = '';

    async function setDeckRoot(root){
      if(!root) return;
      lastDeckRoot = root;
      lastDeckPath = lastDeckRoot + '/index.html';
      document.getElementById('openDeck').href = lastDeckPath;
      document.getElementById('deckFrame').src = lastDeckPath + '?t=' + Date.now();
      localStorage.setItem('studio:lastDeckRoot', lastDeckRoot);
      await loadDeckSpec();
      renderThumbs((deckSpec?.slides || []).length);
      document.getElementById('slideList').textContent = 'Deck: ' + lastDeckRoot.replace(/^\\//,'') + ' • Slides: ' + ((deckSpec?.slides || []).length || 0);
    }

    async function loadDeckSpec(){
      if(!lastDeckRoot) return;
      const r = await fetch(lastDeckRoot + '/deck.json?t=' + Date.now());
      if(!r.ok) return;
      deckSpec = await r.json();
      const sel = document.getElementById('editSlideId');
      sel.innerHTML = '';
      (deckSpec.slides || []).forEach(s => {
        const o = document.createElement('option');
        o.value = s.slide_id;
        o.textContent = s.slide_id + ' — ' + (s.copy?.title || s.title || 'Slide');
        sel.appendChild(o);
      });
      if((deckSpec.slides||[]).length){
        selectedSlide = (deckSpec.slides[0].slide_id);
        sel.value = selectedSlide;
        populateEditor(selectedSlide);
      }
    }

    function populateEditor(slideId){
      selectedSlide = slideId;
      const s = (deckSpec?.slides || []).find(x => x.slide_id === slideId);
      if(!s) return;
      document.getElementById('editLayout').value = s.layout || 'section';
      document.getElementById('editTitle').value = s.copy?.title || s.title || '';
      document.getElementById('editBullets').value = (s.copy?.bullets || s.bullets || []).join('\\n');
      document.getElementById('editImagePrompt').value = s.images?.[0]?.prompt || '';
      document.getElementById('deckFrame').src = lastDeckRoot + '/slides/' + slideId + '.html?t=' + Date.now();
    }

    function renderThumbs(slideCount){
      const row = document.getElementById('thumbRow');
      row.innerHTML = '';
      if(!lastDeckRoot || !slideCount) return;
      for(let i=1;i<=slideCount;i++){
        const id = String(i).padStart(3,'0');
        const col = document.createElement('div');
        col.className = 'col-6 col-md-4 col-xl-3';
        col.innerHTML = '<button type="button" class="btn btn-outline-secondary p-1 w-100 text-start" data-slide="' + id + '" style="height:120px;overflow:hidden">' +
          '<div class="small fw-semibold px-1">Slide ' + i + '</div>' +
          '<iframe src="' + lastDeckRoot + '/slides/' + id + '.html" style="width:220%;height:210px;transform:scale(.45);transform-origin:0 0;border:0;pointer-events:none"></iframe>' +
          '</button>';
        row.appendChild(col);
      }
      row.querySelectorAll('button[data-slide]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.slide;
          document.getElementById('deckFrame').src = lastDeckRoot + '/slides/' + id + '.html?t=' + Date.now();
        });
      });
    }

    async function generate(auto){
      const form = document.getElementById('studioForm');
      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.auto_generate = !!auto;
      const r = await fetch('/api/presentations/pipeline-v2/generate', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const j = await r.json();
      if(!r.ok){ alert(j.error || 'Generation failed'); return; }
      await setDeckRoot('/' + j.deck);
      document.getElementById('slideList').textContent = 'Deck: ' + j.deck + ' • Slides: ' + j.slideCount + ' • Images: ' + j.images;
    }

    async function saveSlide(regenImage){
      if(!lastDeckRoot || !selectedSlide) return;
      const payload = {
        deck: lastDeckRoot.replace(/^\\//,''),
        slide_id: selectedSlide,
        layout: document.getElementById('editLayout').value,
        title: document.getElementById('editTitle').value,
        bullets: document.getElementById('editBullets').value.split('\\n').map(x=>x.trim()).filter(Boolean),
        image_prompt: document.getElementById('editImagePrompt').value,
        regen_image: !!regenImage
      };
      const r = await fetch('/api/presentations/slide/update', {method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const j = await r.json();
      if(!r.ok){ alert(j.error || 'Slide update failed'); return; }
      await loadDeckSpec();
      renderThumbs((deckSpec?.slides || []).length);
      populateEditor(selectedSlide);
    }

    async function deleteSlide(){
      if(!lastDeckRoot || !selectedSlide) return;
      if(!confirm('Delete slide ' + selectedSlide + '? This will renumber following slides.')) return;
      const payload = { deck: lastDeckRoot.replace(/^\\//,''), slide_id: selectedSlide };
      const r = await fetch('/api/presentations/slide/delete', {method:'DELETE', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
      const j = await r.json();
      if(!r.ok){ alert(j.error || 'Delete failed'); return; }
      await loadDeckSpec();
      renderThumbs((deckSpec?.slides || []).length);
      if((deckSpec?.slides || []).length){ populateEditor(deckSpec.slides[0].slide_id); }
      else { document.getElementById('deckFrame').src=''; document.getElementById('slideList').textContent='No slides left in deck.'; }
    }

    document.getElementById('btnGenerate').addEventListener('click', ()=>generate(false));
    document.getElementById('btnAuto').addEventListener('click', ()=>generate(true));
    document.getElementById('editSlideId').addEventListener('change', (e)=>populateEditor(e.target.value));
    document.getElementById('saveSlideBtn').addEventListener('click', ()=>saveSlide(false));
    document.getElementById('regenImageBtn').addEventListener('click', ()=>saveSlide(true));
    document.getElementById('deleteSlideBtn').addEventListener('click', ()=>deleteSlide());

    // Restore last deck after refresh so slide editor is not empty.
    const savedDeck = localStorage.getItem('studio:lastDeckRoot');
    if (savedDeck) {
      setDeckRoot(savedDeck).catch(()=>{});
    }

  </script>
  </body></html>`);
});

app.post('/api/presentations/pipeline-v2/generate', requireRole('architect','editor'), async (req, res) => {
  const initiative_id = String(req.body.initiative_id || '');
  const buyer_id = String(req.body.buyer_id || '');
  const deck_type = String(req.body.deck_type || 'utc-internal');
  const template_id = String(req.body.template_id || 'sovereign-memo');
  const image_provider = String(req.body.image_provider || 'placeholder');
  const prompt = String(req.body.prompt || '');

  const cmd = ['node', path.join(ROOT,'scripts/deck_pipeline_v2.js'), '--initiative_id', initiative_id, '--deck_type', deck_type, '--template_id', template_id, '--image_provider', image_provider, '--prompt', prompt];
  if (buyer_id) cmd.push('--buyer_id', buyer_id);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'pipeline v2 failed').trim() });

  const out = JSON.parse((r.stdout || '{}').trim() || '{}');
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.complete', entity_type: 'presentation', entity_id: `${initiative_id}:${deck_type}`, meta: { stage: 'pipeline_v2', template_id, image_provider, buyer_id: buyer_id || null } });
  await createSnapshot('presentation.pipeline_v2.generate');
  res.json({ ok:true, deck: out.deck || '', slideCount: out.slideCount || 0, images: out.images || 'pipeline' });
});

app.patch('/api/presentations/slide/update', requireRole('architect','editor'), async (req, res) => {
  const deck = String(req.body.deck || '');
  const slide_id = String(req.body.slide_id || '');
  if (!deck || !slide_id) return res.status(400).json({ error: 'deck and slide_id required' });
  const deckPath = path.join(ROOT, deck, 'deck.json');
  const spec = await readJson(deckPath, null);
  if (!spec || !Array.isArray(spec.slides)) return res.status(404).json({ error: 'deck not found' });
  const s = spec.slides.find(x => x.slide_id === slide_id);
  if (!s) return res.status(404).json({ error: 'slide not found' });

  s.layout = String(req.body.layout || s.layout || 'section');
  s.copy = s.copy || {};
  s.copy.title = String(req.body.title || s.copy.title || '');
  s.copy.bullets = Array.isArray(req.body.bullets) ? req.body.bullets : (s.copy.bullets || []);
  if (!Array.isArray(s.bullets)) s.bullets = [];
  s.bullets = s.copy.bullets;
  s.title = s.copy.title;
  if (!Array.isArray(s.images)) s.images = [];
  if (!s.images[0]) s.images[0] = { slot_id: 'img-001', prompt: '', provider: 'placeholder', output_path: `${deck}/assets/${slide_id}-img-001.png` };
  if (typeof req.body.image_prompt === 'string') s.images[0].prompt = req.body.image_prompt;

  await writeJson(deckPath, spec);

  const cmd = ['node', path.join(ROOT,'scripts/deck_pipeline_v2.js'), '--deck_path', deck, '--template_id', spec.deckPlan?.template_id || 'sovereign-memo', '--rerender_slide', slide_id];
  if (Boolean(req.body.regen_image) && s.images[0]?.prompt) cmd.push('--image_provider', s.images[0].provider || 'placeholder');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'rerender failed').trim() });

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.run', entity_type: 'presentation_slide', entity_id: `${deck}:${slide_id}`, meta: { action: 'slide_update' } });
  res.json({ ok: true, slide_id });
});

app.delete('/api/presentations/slide/delete', requireRole('architect','editor'), async (req, res) => {
  const deck = String(req.body.deck || '');
  const slide_id = String(req.body.slide_id || '');
  if (!deck || !slide_id) return res.status(400).json({ error: 'deck and slide_id required' });
  const deckPath = path.join(ROOT, deck, 'deck.json');
  const spec = await readJson(deckPath, null);
  if (!spec || !Array.isArray(spec.slides)) return res.status(404).json({ error: 'deck not found' });
  const idx = spec.slides.findIndex(x => x.slide_id === slide_id);
  if (idx < 0) return res.status(404).json({ error: 'slide not found' });

  spec.slides.splice(idx, 1);
  if (spec.slides.length < 1) return res.status(400).json({ error: 'cannot delete last slide' });

  // Renumber slide ids and image output paths
  spec.slides.forEach((s, i) => {
    const newId = String(i + 1).padStart(3, '0');
    const oldId = s.slide_id;
    s.slide_id = newId;
    if (Array.isArray(s.images)) {
      s.images = s.images.map((img, j) => ({
        ...img,
        output_path: `${deck}/assets/${newId}-img-${String(j + 1).padStart(3, '0')}.png`
      }));
    }
    if (oldId !== newId) {
      // keep copy/title as-is; renderer rebuild will regenerate HTML files with new ids
    }
  });

  spec.deckPlan = spec.deckPlan || {};
  spec.deckPlan.slide_count = spec.slides.length;
  await writeJson(deckPath, spec);

  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', [path.join(ROOT,'scripts/deck_pipeline_v2.js'), '--deck_path', deck, '--template_id', spec.deckPlan?.template_id || 'sovereign-memo', '--rebuild_all', 'true'], { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'rebuild failed').trim() });

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'task.update', entity_type: 'presentation_slide', entity_id: `${deck}:${slide_id}`, meta: { action: 'slide_delete' } });
  res.json({ ok: true, deleted: slide_id, slideCount: spec.slides.length });
});

app.post('/api/presentations/studio/generate', requireRole('architect','editor'), async (req, res) => {
  const initiative_id = String(req.body.initiative_id || '');
  const buyer_id = String(req.body.buyer_id || '');
  const deck_type = String(req.body.deck_type || 'utc-internal');
  const template_id = String(req.body.template_id || 'sovereign-memo');
  const image_provider = String(req.body.image_provider || 'placeholder');
  const copy_provider = String(req.body.copy_provider || 'local');
  const prompt = String(req.body.prompt || '');
  const auto_generate = Boolean(req.body.auto_generate);

  const cmd = ['node', path.join(ROOT,'scripts/generate_deck.js'), '--initiative_id', initiative_id, '--deck_type', deck_type, '--template_id', template_id, '--image_provider', image_provider, '--copy_provider', copy_provider, '--prompt', prompt, '--auto_generate', auto_generate ? 'true' : 'false'];
  if (buyer_id) cmd.push('--buyer_id', buyer_id);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).json({ error: (r.stderr || r.stdout || 'generation failed').trim() });

  const out = JSON.parse((r.stdout || '{}').trim() || '{}');
  const deckPath = out.deck || '';
  let slideCount = 0;
  try {
    const d = await readJson(path.join(ROOT, deckPath, 'deck.json'), {});
    slideCount = (d.slides || []).length;
  } catch {}

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.run', entity_type: 'presentation', entity_id: `${initiative_id}:${deck_type}`, meta: { template_id, image_provider, copy_provider, buyer_id: buyer_id || null, auto_generate } });
  await createSnapshot('presentation.studio.generate');
  res.json({ ok:true, deck: deckPath, slideCount, images: out.images || 'unknown' });
});

app.post('/api/presentations/generate', requireRole('architect','editor'), async (req, res) => {
  const initiative_id = String(req.body.initiative_id || '');
  const buyer_id = String(req.body.buyer_id || '');
  const deck_type = String(req.body.deck_type || 'utc-internal');
  const template_id = String(req.body.template_id || 'sovereign-memo');
  const image_provider = String(req.body.image_provider || 'placeholder');
  const copy_provider = String(req.body.copy_provider || 'local');
  const cmd = ['node', path.join(ROOT,'scripts/generate_deck.js'), '--initiative_id', initiative_id, '--deck_type', deck_type, '--template_id', template_id, '--image_provider', image_provider, '--copy_provider', copy_provider];
  if (buyer_id) cmd.push('--buyer_id', buyer_id);
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(cmd[0], cmd.slice(1), { cwd: ROOT, encoding:'utf8', env: process.env });
  if (r.status !== 0) return res.status(500).send(`generation failed: ${r.stderr || r.stdout}`);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req)||'editor', event_type: 'workflow.run', entity_type: 'presentation', entity_id: `${initiative_id}:${deck_type}`, meta: { template_id, image_provider, copy_provider, buyer_id: buyer_id || null } });
  await createSnapshot('presentation.generate');
  res.redirect(`/dashboard/initiative/${encodeURIComponent(initiative_id)}${buyer_id ? `?buyer_id=${encodeURIComponent(buyer_id)}` : ''}`);
});

app.use('/presentations', express.static(path.join(ROOT, 'presentations'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) { res.setHeader('Cache-Control', 'no-store'); }
}));

app.use('/dashboard', express.static(path.join(ROOT, 'dashboard'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

app.get('/healthz', (_req, res) => res.json({ ok: true, ts: nowIso() }));

app.get('/admin/login', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Admin Login')}</head>
<body>
<div class="app-shell" style="max-width:560px">
  <div class="card shadow-sm">
    <div class="card-body p-4">
      <h3 class="mb-3">Sentinel Admin Login</h3>
      <form method="post" action="/admin/login" class="vstack gap-3">
        <div>
          <label class="form-label">Password</label>
          <input class="form-control" type="password" name="password" required autofocus />
        </div>
        <button class="btn btn-primary" type="submit">Login</button>
      </form>
    </div>
  </div>
</div>
</body></html>`);
});

app.post('/admin/login', loginRateLimit, async (req, res) => {
  const ip = req.ip || 'unknown';
  const password = String(req.body.password || '');
  const ok = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

  if (!ok) {
    await appendAdminLog(`FAILED_LOGIN ip=${ip}`);
    await appendAuditEvent({ ts: nowIso(), actor: 'unknown', role: 'anonymous', event_type: 'login.failed', entity_type: 'auth', entity_id: 'admin', meta: { ip } });
    return res.status(401).send('Invalid credentials');
  }

  resetLoginAttempts(ip);
  req.session.user = { scope: 'admin', username: ARCHITECT_USERNAME, role: 'architect', loginAt: nowIso() };
  await appendAdminLog(`SUCCESS_LOGIN ip=${ip}`);
  await appendAuditEvent({ ts: nowIso(), actor: ARCHITECT_USERNAME, role: 'architect', event_type: 'login.success', entity_type: 'auth', entity_id: 'admin', meta: { ip } });
  return res.redirect('/admin');
});

app.post('/admin/logout', requireAdminAuth, async (req, res) => {
  const ip = req.ip || 'unknown';
  req.session.destroy(() => undefined);
  await appendAdminLog(`LOGOUT ip=${ip}`);
  res.redirect('/admin/login');
});

app.get('/admin', requireAdminAuth, async (_req, res) => {
  let state = null;
  try {
    const raw = await fs.readFile(DASHBOARD_STATE_FILE, 'utf8');
    state = JSON.parse(raw);
  } catch {}

  const updated = Array.isArray(state?.updatedDocs) ? state.updatedDocs.join(', ') : 'N/A';
  const totalFiles = state?.uosCurrent
    ? Object.values(state.uosCurrent).reduce((n, v) => n + (v.fileCount || 0), 0)
    : 0;

  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Admin Panel')}</head><body>
<div class="app-shell">
  ${adminNav('panel')}
  <div class="row g-3">
    <div class="col-12 col-lg-7">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <h4 class="card-title">UOS Upload Control</h4>
          <p class="text-muted">Upload files for Execution Engine, Canon, and Revenue OS.</p>
          <div class="d-flex flex-wrap gap-2">
            <a class="btn btn-primary" href="/admin/upload">Go to Upload</a>
            <a class="btn btn-outline-secondary" href="/dashboard/">View Dashboard</a>
          </div>
        </div>
      </div>
    </div>

    <div class="col-12 col-lg-5">
      <div class="card shadow-sm h-100">
        <div class="card-body">
          <h4 class="card-title">Latest State</h4>
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-flex justify-content-between"><span>Last updated</span><span class="mono small">${escapeHtml(state?.lastUpdated || 'N/A')}</span></li>
            <li class="list-group-item d-flex justify-content-between"><span>Updated docs</span><span class="small">${escapeHtml(updated)}</span></li>
            <li class="list-group-item d-flex justify-content-between"><span>Total active files</span><strong>${totalFiles}</strong></li>
            <li class="list-group-item d-flex justify-content-between"><span>Archive batch</span><span class="mono small">${escapeHtml(state?.latestArchiveBatch || 'N/A')}</span></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`);
});

app.get('/admin/upload', requireAdminAuth, (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head>${uiHead('UOS Upload')}</head>
<body>
<div class="app-shell">
${adminNav('upload')}
<div class="card shadow-sm">
  <div class="card-body">
    <h3 class="card-title">UOS Admin Upload</h3>
    <p class="text-muted">Upload multiple docs per category (.md, .txt, .pdf, .docx), max 20MB each file.</p>

    <form id="uploadForm" method="post" action="/admin/upload" enctype="multipart/form-data" class="vstack gap-3">
      <div class="row g-3">
        <div class="col-12 col-lg-4">
          <div class="dropzone" data-input="executionEngine">
            <label class="form-label d-flex justify-content-between">Execution Engine <span class="badge text-bg-primary" id="executionEngineCount">0 files</span></label>
            <input class="form-control" type="file" id="executionEngine" name="executionEngine" multiple required />
            <div class="form-text">Drag & drop files here or use file picker.</div>
            <div class="small mt-2" id="executionEngineList"></div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="dropzone" data-input="canon">
            <label class="form-label d-flex justify-content-between">Canon <span class="badge text-bg-primary" id="canonCount">0 files</span></label>
            <input class="form-control" type="file" id="canon" name="canon" multiple required />
            <div class="form-text">Drag & drop files here or use file picker.</div>
            <div class="small mt-2" id="canonList"></div>
          </div>
        </div>

        <div class="col-12 col-lg-4">
          <div class="dropzone" data-input="revenueOS">
            <label class="form-label d-flex justify-content-between">Revenue OS <span class="badge text-bg-primary" id="revenueOSCount">0 files</span></label>
            <input class="form-control" type="file" id="revenueOS" name="revenueOS" multiple required />
            <div class="form-text">Drag & drop files here or use file picker.</div>
            <div class="small mt-2" id="revenueOSList"></div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-primary" type="submit">Upload + Rebuild Dashboard State</button>
      </div>
    </form>
  </div>
</div>
</div>

<script>
const allowed = new Set(['.md','.txt','.pdf','.docx']);
const maxBytes = 20 * 1024 * 1024;
function ext(name){ const i=name.lastIndexOf('.'); return i>=0 ? name.slice(i).toLowerCase() : ''; }
function render(inputId){
  const input = document.getElementById(inputId);
  const count = document.getElementById(inputId + 'Count');
  const list = document.getElementById(inputId + 'List');
  const files = Array.from(input.files || []);
  count.textContent = files.length + (files.length === 1 ? ' file' : ' files');
  list.innerHTML = files.slice(0, 12).map(f => {
    const badType = !allowed.has(ext(f.name));
    const badSize = f.size > maxBytes;
    const flags = [badType ? 'bad type' : '', badSize ? 'too large' : ''].filter(Boolean).join(', ');
    return '<div>' + f.name + (flags ? ' ⚠️ ' + flags : '') + '</div>';
  }).join('') || '<em>No files selected</em>';
}
function mergeFiles(input, droppedFiles){
  const dt = new DataTransfer();
  Array.from(input.files || []).forEach(f => dt.items.add(f));
  Array.from(droppedFiles || []).forEach(f => dt.items.add(f));
  input.files = dt.files;
  render(input.id);
}
['executionEngine','canon','revenueOS'].forEach(id => {
  const input = document.getElementById(id);
  input.addEventListener('change', () => render(id));
  render(id);
  const zone = document.querySelector('.dropzone[data-input="' + id + '"]');
  ['dragenter','dragover'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', (e) => mergeFiles(input, e.dataTransfer.files));
});
</script>
</body></html>`);
});


app.post(
  '/admin/upload',
  requireAdminAuth,
  upload.fields([
    { name: 'executionEngine', maxCount: MAX_FILES_PER_CATEGORY },
    { name: 'canon', maxCount: MAX_FILES_PER_CATEGORY },
    { name: 'revenueOS', maxCount: MAX_FILES_PER_CATEGORY },
  ]),
  async (req, res) => {
    try {
      const files = req.files || {};
      for (const field of REQUIRED_FIELDS) {
        if (!files[field] || files[field].length === 0) {
          return res.status(400).send(`Missing required file(s): ${field}`);
        }
      }

      const uploads = REQUIRED_FIELDS.flatMap((field) =>
        (files[field] || []).map((file, idx) => ({ field, file, idx }))
      );

      for (const { field, file } of uploads) {
        if (file.size > MAX_FILE_SIZE) {
          return res.status(400).send(`${field} file ${file.originalname} exceeds max size 20MB`);
        }
        const extension = ext(file.originalname);
        if (!ALLOWED_EXTENSIONS.has(extension)) {
          return res.status(400).send(`${field} invalid type: ${extension} (${file.originalname})`);
        }
      }

      await ensureDirs();

      const day = dateOnly();
      const stamp = tsForPath();
      const inboxDir = path.join(INBOX_ROOT, day);
      const archiveDir = path.join(ARCHIVE_ROOT, stamp);
      await fs.mkdir(inboxDir, { recursive: true });
      await fs.mkdir(archiveDir, { recursive: true });

      const pendingBatchDir = path.join(UOS_PENDING_ROOT, stamp);
      await fs.mkdir(pendingBatchDir, { recursive: true });
      for (const field of REQUIRED_FIELDS) {
        const key = fieldNameToCanonical(field);
        const pendingCategoryDir = path.join(pendingBatchDir, key);
        await fs.mkdir(pendingCategoryDir, { recursive: true });
      }

      const updates = [];

      for (const { field, file, idx } of uploads) {
        const originalName = safeName(file.originalname);
        const fieldPrefix = fieldNameToCanonical(field);
        const extension = ext(originalName);
        const fileStem = `${String(idx + 1).padStart(3, '0')}-${safeName(base(originalName))}`;

        const inboxPath = path.join(inboxDir, `${fieldPrefix}__${fileStem}${extension}`);
        const archiveOriginalPath = path.join(archiveDir, `${fieldPrefix}__${fileStem}${extension}`);

        await fs.writeFile(inboxPath, file.buffer);
        await fs.writeFile(archiveOriginalPath, file.buffer);

        const normalizedMarkdown = await normalizeToMarkdown(fieldPrefix, originalName, file.buffer);

        const pendingPath = path.join(UOS_PENDING_ROOT, stamp, fieldPrefix, `${fileStem}.md`);
        const archiveNormalizedPath = path.join(archiveDir, `${fieldPrefix}__${fileStem}.md`);

        await fs.writeFile(pendingPath, normalizedMarkdown, 'utf8');
        await fs.writeFile(archiveNormalizedPath, normalizedMarkdown, 'utf8');

        updates.push({
          field,
          key: fieldPrefix,
          originalName,
          extension,
          inboxPath: rel(inboxPath),
          pendingPath: rel(pendingPath),
          archiveOriginalPath: rel(archiveOriginalPath),
          archiveNormalizedPath: rel(archiveNormalizedPath),
        });
      }

      const uosEntityId = `UOS-${stamp}`;
      const rp = await createReviewPacketStub({
        title: `UOS Upload ${stamp}`,
        linkedTaskId: uosEntityId,
        createdBy: getUserLabel(req),
        status: 'Draft',
        recommendedAction: 'Approve',
      });

      const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
      state.lastUpdated = nowIso();
      state.latestUosUpload = {
        id: uosEntityId,
        batch: stamp,
        totalFiles: updates.length,
        pendingDir: rel(path.join(UOS_PENDING_ROOT, stamp)),
        archiveDir: rel(archiveDir),
        reviewPacketId: rp.rpId,
        status: 'Draft',
      };
      await writeJson(DASHBOARD_STATE_FILE, state);

      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'uos.upload', entity_type: 'uos_batch', entity_id: uosEntityId, meta: { total_files: updates.length, pending_dir: rel(path.join(UOS_PENDING_ROOT, stamp)), archive_dir: rel(archiveDir), review_packet_id: rp.rpId } });
      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'uos.archive', entity_type: 'uos_batch', entity_id: uosEntityId, meta: { archive_dir: rel(archiveDir) } });
      await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.create', entity_type: 'review_packet', entity_id: rp.rpId, meta: { linked_task: uosEntityId } });
      await appendAdminLog(`UPLOAD_SUCCESS count=${updates.length} files=${updates.map((u) => u.originalName).join(',')} archive=${rel(archiveDir)} pending=${rel(path.join(UOS_PENDING_ROOT, stamp))} rp=${rp.rpId}`);
      await createSnapshot('uos.upload');

      res.type('html').send(`<!doctype html>
<html><head>${uiHead('Upload Complete')}</head><body>
<div class="app-shell" style="max-width:860px">
  ${adminNav('upload')}
  <div class="card shadow-sm">
    <div class="card-body">
      <h3 class="card-title">Upload complete</h3>
      <p class="text-muted">Files staged to pending. Publish requires approved review packet.</p>
      <pre class="p-3 bg-body-tertiary border rounded">${escapeHtml(JSON.stringify({ updatedCategories: [...new Set(updates.map((u) => u.key))], totalFiles: updates.length, pendingDir: rel(path.join(UOS_PENDING_ROOT, stamp)), archiveDir: rel(archiveDir), reviewPacketId: rp.rpId, at: nowIso() }, null, 2))}</pre>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <a class="btn btn-primary" href="/dashboard/review">Open Review Queue</a>
        <a class="btn btn-outline-secondary" href="/admin/upload">Upload Another Batch</a>
      </div>
    </div>
  </div>
</div>
</body></html>`);
    } catch (err) {
      await appendAdminLog(`UPLOAD_ERROR error=${String(err?.message || err)}`);
      res.status(500).send(`Upload failed: ${err.message || err}`);
    }
  }
);

// -------- Team Auth + Kanban Board --------
const teamLoginAttempts = new Map();
const ajv = new Ajv({ allErrors: true });
let boardValidator = null;

function defaultBoardSchema() {
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    required: ['version', 'tasks'],
    properties: {
      version: { type: 'integer' },
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'title', 'status', 'priority', 'comments', 'created_at', 'updated_at', 'created_by', 'updated_by'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string', minLength: 1 },
            status: { type: 'string', enum: BOARD_COLUMNS },
            owner: { type: ['string', 'null'] },
            due_date: { type: ['string', 'null'] },
            priority: { type: 'string', enum: BOARD_PRIORITIES },
            tags: { type: 'array', items: { type: 'string' } },
            linked_refs: { type: 'array', items: { type: 'string' } },
            description: { type: ['string', 'null'] },
            comments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['id', 'author', 'text', 'created_at'],
                properties: {
                  id: { type: 'string' },
                  author: { type: 'string' },
                  text: { type: 'string' },
                  created_at: { type: 'string' },
                },
              },
            },
            request_approval: { type: ['object', 'null'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            created_by: { type: 'string' },
            updated_by: { type: 'string' },
          },
        },
      },
    },
  };
}

function defaultBoard() {
  return { version: 1, tasks: [] };
}

function defaultUsers() {
  return { users: [], invites: [] };
}

async function ensureTeamAndBoardFiles() {
  if (!fssync.existsSync(TEAM_USERS_FILE)) {
    await fs.writeFile(TEAM_USERS_FILE, JSON.stringify(defaultUsers(), null, 2));
  }
  if (!fssync.existsSync(BOARD_SCHEMA_FILE)) {
    await fs.writeFile(BOARD_SCHEMA_FILE, JSON.stringify(defaultBoardSchema(), null, 2));
  }
  if (!fssync.existsSync(BOARD_FILE)) {
    await fs.writeFile(BOARD_FILE, JSON.stringify(defaultBoard(), null, 2));
  }
  await loadBoardValidator();
}

async function loadBoardValidator() {
  const schema = JSON.parse(await fs.readFile(BOARD_SCHEMA_FILE, 'utf8'));
  boardValidator = ajv.compile(schema);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function sanitizeTaskPatch(input = {}) {
  const out = {};
  if (typeof input.title === 'string') out.title = input.title.trim();
  if (typeof input.owner === 'string' || input.owner === null) out.owner = input.owner;
  if (typeof input.due_date === 'string' || input.due_date === null) out.due_date = input.due_date;
  if (typeof input.priority === 'string') out.priority = input.priority;
  if (Array.isArray(input.tags)) out.tags = input.tags.map(String).map((x) => x.trim()).filter(Boolean);
  if (Array.isArray(input.linked_refs)) out.linked_refs = input.linked_refs.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof input.description === 'string' || input.description === null) out.description = input.description;
  return out;
}

function taskSortScore(t) {
  const p = { P0: 0, P1: 1, P2: 2, P3: 3 }[t.priority] ?? 99;
  const d = t.due_date ? new Date(t.due_date).getTime() : Number.MAX_SAFE_INTEGER;
  return [p, d, t.updated_at || ''];
}

function limitAttempt(map, key, max = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const row = map.get(key);
  if (!row || now - row.firstTs > windowMs) {
    map.set(key, { count: 1, firstTs: now });
    return true;
  }
  if (row.count >= max) return false;
  row.count += 1;
  map.set(key, row);
  return true;
}

function clearAttempt(map, key) { map.delete(key); }

async function appendJsonl(dirRoot, obj) {
  const d = dateOnly();
  const p = path.join(dirRoot, `${d}.jsonl`);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.appendFile(p, JSON.stringify(obj) + '\n', 'utf8');
}

async function appendAuditEvent(event) {
  const normalized = {
    ts: event.ts || nowIso(),
    actor: event.actor || 'unknown',
    role: event.role || 'unknown',
    event_type: event.event_type || 'system.event',
    entity_type: event.entity_type || 'system',
    entity_id: event.entity_id || null,
    meta: event.meta || {},
  };
  await appendJsonl(ACTIVITY_ROOT, normalized);
  if ((normalized.entity_type === 'task' || String(normalized.event_type || '').startsWith('task.')) && normalized.entity_id) {
    await appendJsonl(BOARD_HISTORY_ROOT, normalized);
  }
}

async function createSnapshot(reason = 'state.change') {
  const stamp = tsForPath();
  const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
  const snapshotPath = path.join(DASHBOARD_SNAPSHOTS, `${stamp}.json`);
  await writeJson(snapshotPath, state);
  const change = `## ${nowIso()}\n- Snapshot reason: ${reason}\n- Snapshot: \`${rel(snapshotPath)}\`\n\n`;
  if (!fssync.existsSync(DASHBOARD_CHANGELOG)) {
    await fs.writeFile(DASHBOARD_CHANGELOG, '# Dashboard State Changelog\n\n', 'utf8');
  }
  await fs.appendFile(DASHBOARD_CHANGELOG, change, 'utf8');
}

async function writeBoard(board, actor, eventType, taskId, before, after, role = 'editor') {
  if (!boardValidator) await loadBoardValidator();
  const ok = boardValidator(board);
  if (!ok) {
    throw new Error('BOARD validation failed: ' + ajv.errorsText(boardValidator.errors));
  }
  await writeJson(BOARD_FILE, board);

  await appendAuditEvent({
    ts: nowIso(),
    actor,
    role,
    event_type: eventType,
    entity_type: 'task',
    entity_id: taskId || null,
    meta: { before: before || null, after: after || null },
  });
  await refreshBoardStateIntegration(board);
  await createSnapshot(`board.${eventType}`);
}

async function readActivityEvents({ limit = 20, actor, entity_type, date, maxScan = 1000 } = {}) {
  const files = (await fs.readdir(ACTIVITY_ROOT).catch(() => []))
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .reverse();

  const out = [];
  let scanned = 0;

  for (const f of files) {
    if (date && !f.startsWith(date)) continue;
    const lines = (await fs.readFile(path.join(ACTIVITY_ROOT, f), 'utf8').catch(() => '')).split('\n').filter(Boolean).reverse();
    for (const line of lines) {
      if (scanned >= maxScan) break;
      scanned += 1;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      if (actor && String(ev.actor || '').toLowerCase() !== String(actor).toLowerCase()) continue;
      if (entity_type && ev.entity_type !== entity_type) continue;
      out.push(ev);
      if (out.length >= limit) return out;
    }
    if (scanned >= maxScan) break;
  }

  return out;
}

async function listReviewPackets(limit = 50) {
  const files = (await fs.readdir(REVIEW_PACKET_ROOT).catch(() => []))
    .filter((f) => /^RP-\d+/i.test(f) && f.endsWith('.md'))
    .sort((a, b) => {
      const na = Number((a.match(/^RP-(\d+)/i) || [0, 0])[1]);
      const nb = Number((b.match(/^RP-(\d+)/i) || [0, 0])[1]);
      if (na !== nb) return nb - na;
      return b.localeCompare(a);
    })
    .slice(0, limit);

  const out = [];
  for (const f of files) {
    const full = path.join(REVIEW_PACKET_ROOT, f);
    const txt = await fs.readFile(full, 'utf8').catch(() => '');
    const m = txt.match(/^---\n([\s\S]*?)\n---/);
    const front = {};
    if (m) {
      for (const line of m[1].split('\n')) {
        const i = line.indexOf(':');
        if (i > 0) front[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
    }

    const rpFromFile = (f.match(/^(RP-\d+)/i) || [null, null])[1];
    const titleFromHeader = ((txt.match(/^#\s+(.+)$/m) || [null, null])[1] || '').trim();

    out.push({
      rp_id: front.rp_id || rpFromFile || 'N/A',
      title: front.title || titleFromHeader || f,
      linked_task: front.linked_task || '',
      created_at: front.created_at || '',
      created_by: front.created_by || '',
      status: front.status || (m ? 'Draft' : 'Legacy'),
      recommended_action: front.recommended_action || '',
      path: rel(full),
    });
  }
  return out;
}

async function refreshBoardStateIntegration(board) {
  const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
  const counts = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, 0]));
  for (const t of board.tasks) counts[t.status] = (counts[t.status] || 0) + 1;

  const sorted = [...board.tasks].sort((a, b) => {
    const [ap, ad] = taskSortScore(a);
    const [bp, bd] = taskSortScore(b);
    if (ap !== bp) return ap - bp;
    return ad - bd;
  });

  state.board = {
    counts,
    top10: sorted.slice(0, 10).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date || null,
      owner: t.owner || null,
      review_packet_id: t.review_packet_id || null,
    })),
    last10Activity: await readActivityEvents({ limit: 10 }),
  };

  state.pendingReviewPackets = (await listReviewPackets(200)).filter((rp) => rp.status === 'Ready for Review').length;
  await writeJson(DASHBOARD_STATE_FILE, state);
}

function formatRpFrontmatter(obj) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(`${k}: ${v === null ? 'null' : String(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

async function createReviewPacketStub({ title, linkedTaskId, createdBy, status = 'Draft', recommendedAction = 'Approve' }) {
  const files = (await fs.readdir(REVIEW_PACKET_ROOT).catch(() => [])).filter((f) => /^RP-\d+/i.test(f));
  const maxN = files.reduce((m, f) => {
    const mm = f.match(/^RP-(\d+)/i);
    return mm ? Math.max(m, Number(mm[1])) : m;
  }, 0);
  const next = String(maxN + 1).padStart(4, '0');
  const rpId = `RP-${next}`;
  const slug = safeName((title || linkedTaskId || 'review-packet').toLowerCase()).slice(0, 80);
  const filename = `${rpId}-${slug}.md`;
  const full = path.join(REVIEW_PACKET_ROOT, filename);
  const fm = formatRpFrontmatter({
    rp_id: rpId,
    title: title || 'Review Packet',
    linked_task: linkedTaskId || 'null',
    created_by: createdBy,
    created_at: nowIso(),
    status,
    recommended_action: recommendedAction,
    architect_decision: 'null',
    architect_notes: 'null',
  });
  await fs.writeFile(full, `${fm}# ${title || 'Review Packet'}\n\n## Summary\n\n(complete)\n`, 'utf8');
  return { rpId, path: rel(full), fullPath: full };
}

async function parseRpFileById(rpId) {
  const files = (await fs.readdir(REVIEW_PACKET_ROOT).catch(() => []))
    .filter((f) => f.startsWith(rpId + '-'));
  if (!files.length) return null;
  const full = path.join(REVIEW_PACKET_ROOT, files[0]);
  const txt = await fs.readFile(full, 'utf8');
  const m = txt.match(/^---\n([\s\S]*?)\n---/);
  const front = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) front[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { front, full, text: txt };
}

async function updateRpFrontmatter(rpId, patch) {
  const parsed = await parseRpFileById(rpId);
  if (!parsed) throw new Error('RP not found');
  const nextFront = { ...parsed.front, ...patch };
  const rest = parsed.text.replace(/^---\n[\s\S]*?\n---\n?/, '');
  const next = formatRpFrontmatter(nextFront) + rest;
  await fs.writeFile(parsed.full, next, 'utf8');
  return { path: rel(parsed.full), front: nextFront };
}

function getUserLabel(req) {
  const u = currentUser(req);
  return u?.username || 'unknown';
}

app.get('/auth/login', (_req, res) => {
  res.type('html').send(`<!doctype html><html><head>${uiHead('Team Login')}</head><body>
  <div class="app-shell" style="max-width:560px">
    <div class="card shadow-sm"><div class="card-body p-4">
      <h3>Team Login</h3>
      <form method="post" action="/auth/login" class="vstack gap-3">
        <input class="form-control" name="username" placeholder="Username" required />
        <input class="form-control" type="password" name="password" placeholder="Password" required />
        <button class="btn btn-primary" type="submit">Sign in</button>
      </form>
      <p class="text-muted mt-3 mb-0">Need an invite? Ask your admin for a link.</p>
    </div></div></div>
  </body></html>`);
});

app.post('/auth/login', async (req, res) => {
  const ip = req.ip || 'unknown';
  if (!limitAttempt(teamLoginAttempts, `team:${ip}`)) {
    return res.status(429).send('Too many login attempts. Try again later.');
  }

  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const user = (data.users || []).find((u) => u.username === username && u.active !== false);
  if (!user) {
    await appendAuditEvent({ ts: nowIso(), actor: username || 'unknown', role: 'anonymous', event_type: 'login.failed', entity_type: 'auth', entity_id: 'team', meta: { ip } });
    return res.status(401).send('Invalid credentials');
  }

  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) {
    await appendAuditEvent({ ts: nowIso(), actor: username, role: normalizedRole(user.role || 'observer'), event_type: 'login.failed', entity_type: 'auth', entity_id: 'team', meta: { ip } });
    return res.status(401).send('Invalid credentials');
  }

  clearAttempt(teamLoginAttempts, `team:${ip}`);
  req.session.user = { scope: 'team', username: user.username, role: normalizedRole(user.role), loginAt: nowIso() };
  await appendAuditEvent({ ts: nowIso(), actor: user.username, role: normalizedRole(user.role), event_type: 'login.success', entity_type: 'auth', entity_id: 'team', meta: { ip } });
  return res.redirect('/board');
});

app.post('/auth/logout', requireAnyAuth, async (req, res) => {
  const actor = getUserLabel(req);
  const role = effectiveRole(req) || 'anonymous';
  req.session.destroy(() => undefined);
  await appendAuditEvent({ ts: nowIso(), actor, role, event_type: 'admin.logout', entity_type: 'auth', entity_id: 'logout', meta: {} });
  res.redirect('/auth/login');
});

app.get('/auth/invite/:token', async (req, res) => {
  const token = String(req.params.token || '');
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const invite = (data.invites || []).find((i) => i.token === token && !i.usedAt && (!i.expiresAt || new Date(i.expiresAt).getTime() > Date.now()));
  if (!invite) return res.status(404).send('Invite link is invalid or expired.');
  res.type('html').send(`<!doctype html><html><head>${uiHead('Accept Invite')}</head><body>
  <div class="app-shell" style="max-width:620px"><div class="card shadow-sm"><div class="card-body p-4">
    <h3>Create Team Account</h3>
    <p class="text-muted">Role: ${escapeHtml(invite.role)}</p>
    <form method="post" action="/auth/invite/${encodeURIComponent(token)}" class="vstack gap-3">
      <input class="form-control" name="username" placeholder="Username" required />
      <input class="form-control" type="password" name="password" placeholder="Password" required />
      <button class="btn btn-primary" type="submit">Create account</button>
    </form>
  </div></div></div></body></html>`);
});

app.post('/auth/invite/:token', async (req, res) => {
  const token = String(req.params.token || '');
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || password.length < 8) return res.status(400).send('Username and strong password are required.');

  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const invite = (data.invites || []).find((i) => i.token === token && !i.usedAt && (!i.expiresAt || new Date(i.expiresAt).getTime() > Date.now()));
  if (!invite) return res.status(404).send('Invite link is invalid or expired.');
  if ((data.users || []).some((u) => u.username === username)) return res.status(409).send('Username already exists.');

  const hash = await bcrypt.hash(password, 12);
  const user = { id: crypto.randomUUID(), username, role: invite.role, passwordHash: hash, active: true, createdAt: nowIso(), invitedBy: invite.createdBy || 'admin' };
  data.users.push(user);
  invite.usedAt = nowIso();
  invite.usedBy = username;
  await writeJson(TEAM_USERS_FILE, data);
  await appendAuditEvent({ ts: nowIso(), actor: username, role: normalizedRole(user.role), event_type: 'admin.invite.accept', entity_type: 'user', entity_id: username, meta: { role: normalizedRole(user.role) } });
  res.redirect('/auth/login');
});

app.get('/board', requireAnyAuth, async (_req, res) => {
  const u = _req.session.user;
  const canWrite = ['architect', 'editor'].includes(u.role);
  res.type('html').send(`<!doctype html><html><head>${uiHead('Task Board')}</head><body>
  <div class="app-shell">
    <nav class="navbar navbar-expand-lg bg-body-tertiary border rounded-3 px-3 mb-3 oc-nav">
      <a class="navbar-brand fw-bold" href="/board">Task Board</a>
      <div class="navbar-nav me-auto">
        <a class="nav-link" href="/dashboard/">Dashboard</a>
        <a class="nav-link" href="/dashboard/buyers">Buyers</a>
        <a class="nav-link" href="/dashboard/presentation-studio">Presentation Studio</a>
        <span class="nav-link disabled">${escapeHtml(u.username)} (${escapeHtml(u.role)})</span>
      </div>
      <form method="post" action="/auth/logout" class="d-flex m-0 w-100 w-md-auto"><button class="btn btn-sm btn-outline-secondary logout-btn" type="submit">Logout</button></form>
    </nav>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <a class="btn btn-outline-secondary" href="/dashboard/">Go to Dashboard</a>
      <a class="btn btn-outline-secondary" href="/dashboard/presentation-studio">Open Presentation Studio</a>
      ${canWrite ? '<button id="newTaskBtn" class="btn btn-primary">New Task</button>' : ''}
      ${u.role === 'architect' ? '<button id="inviteBtn" class="btn btn-outline-primary">Create Invite Link</button>' : ''}
    </div>

    <div id="board" class="row g-3"></div>
  </div>

  <div class="modal fade" id="taskModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title" id="taskModalTitle">Task</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <form id="taskForm" class="row g-3">
          <input type="hidden" id="taskId" />
          <div class="col-12"><label class="form-label">Title</label><input class="form-control" id="f_title" required /></div>
          <div class="col-12 col-md-6"><label class="form-label">Owner</label><input class="form-control" id="f_owner" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Due date</label><input type="date" class="form-control" id="f_due_date" /></div>
          <div class="col-12 col-md-6"><label class="form-label">Priority</label><select class="form-select" id="f_priority"><option>P0</option><option>P1</option><option selected>P2</option><option>P3</option></select></div>
          <div class="col-12 col-md-6"><label class="form-label">Tags (comma separated)</label><input class="form-control" id="f_tags" /></div>
          <div class="col-12"><label class="form-label">Linked refs (comma separated)</label><input class="form-control" id="f_refs" /></div>
          <div class="col-12"><label class="form-label">Description</label><textarea class="form-control" id="f_desc" rows="4"></textarea></div>
        </form>
      </div>
      <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button id="saveTaskBtn" class="btn btn-primary">Save</button></div>
    </div></div>
  </div>

  <div class="modal fade" id="commentModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog"><div class="modal-content">
      <div class="modal-header"><h5 class="modal-title">Comment</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
      <div class="modal-body">
        <input type="hidden" id="commentTaskId" />
        <textarea class="form-control" id="commentText" rows="4" placeholder="Write a comment..."></textarea>
      </div>
      <div class="modal-footer"><button class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button id="saveCommentBtn" class="btn btn-primary">Add Comment</button></div>
    </div></div>
  </div>

<script>
const me = ${JSON.stringify(u)};
const canWrite = ${JSON.stringify(canWrite)};
const columns = ${JSON.stringify(BOARD_COLUMNS)};
let boardData = { tasks: [] };

const taskModalEl = document.getElementById('taskModal');
const commentModalEl = document.getElementById('commentModal');
const hasBootstrapModal = !!(window.bootstrap && window.bootstrap.Modal);
const taskModal = hasBootstrapModal ? new bootstrap.Modal(taskModalEl) : null;
const commentModal = hasBootstrapModal ? new bootstrap.Modal(commentModalEl) : null;

function toArray(v){ return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }

function esc(s){ return String(s ?? '').replace(/[&<>]/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

function cardHTML(t){
  const due = t.due_date ? 'Due: ' + t.due_date : '';
  const comments = (t.comments || []).length;
  let actionButtons = '';
  if (canWrite) {
    actionButtons = '<div class="mt-2 d-flex gap-1 flex-wrap">' +
      '<button class="btn btn-sm btn-outline-secondary js-edit" data-id="' + t.id + '">Edit</button>' +
      '<button class="btn btn-sm btn-outline-secondary js-comment" data-id="' + t.id + '">Comment</button>' +
      '<button class="btn btn-sm btn-outline-warning js-request" data-id="' + t.id + '">Request Approval</button>' +
      ((me.role === 'architect' && t.request_approval && !t.request_approval.approved)
        ? '<button class="btn btn-sm btn-success js-approve" data-id="' + t.id + '">Approve</button>'
        : '') +
      '</div>';
  }

  return [
    '<div class="card mb-2" draggable="' + (canWrite ? 'true' : 'false') + '" data-task-id="' + t.id + '"><div class="card-body p-2">',
    '<div class="d-flex justify-content-between"><strong>' + esc(t.title) + '</strong><span class="badge text-bg-secondary">' + esc(t.priority) + '</span></div>',
    '<div class="small text-muted">Owner: ' + esc(t.owner || '—') + ' ' + esc(due) + '</div>',
    '<div class="small">' + esc((t.tags||[]).join(', ')) + '</div>',
    '<div class="small text-muted">Comments: ' + comments + '</div>',
    actionButtons,
    '</div></div>'
  ].join('');
}

function render(){
  const el = document.getElementById('board');
  el.innerHTML = columns.map(c => {
    const tasks = (boardData.tasks||[]).filter(t => t.status===c);
    return [
      '<div class="col-12 col-xl"><div class="card h-100">',
      '<div class="card-header"><strong>' + c + '</strong> <span class="badge text-bg-light">' + tasks.length + '</span></div>',
      '<div class="card-body" data-column="' + c + '" ondragover="allowDrop(event)" ondrop="dropTask(event,this.dataset.column)">',
      tasks.map(cardHTML).join(''),
      '</div></div></div>'
    ].join('');
  }).join('');

  if (canWrite) {
    document.querySelectorAll('[draggable="true"]').forEach(node => {
      node.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', node.dataset.taskId));
    });
    document.querySelectorAll('.js-edit').forEach(btn => btn.addEventListener('click', () => openEditTask(btn.dataset.id)));
    document.querySelectorAll('.js-comment').forEach(btn => btn.addEventListener('click', () => openCommentModal(btn.dataset.id)));
    document.querySelectorAll('.js-request').forEach(btn => btn.addEventListener('click', () => requestApproval(btn.dataset.id)));
    document.querySelectorAll('.js-approve').forEach(btn => btn.addEventListener('click', () => approveTask(btn.dataset.id)));
  }
}

async function loadBoard(){
  const r = await fetch('/api/board');
  boardData = await r.json();
  render();
}

function allowDrop(e){ if (canWrite) e.preventDefault(); }
async function dropTask(e, status){
  if (!canWrite) return;
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  await fetch('/api/tasks/' + encodeURIComponent(id) + '/move', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ status }) });
  await loadBoard();
}

async function quickTaskFlow(existing){
  const title = prompt('Task title', existing?.title || ''); if(!title) return;
  const owner = prompt('Owner', existing?.owner || '') || null;
  const due_date = prompt('Due date YYYY-MM-DD', existing?.due_date || '') || null;
  const priority = prompt('Priority P0/P1/P2/P3', existing?.priority || 'P2') || 'P2';
  const tags = toArray(prompt('Tags comma-separated', (existing?.tags || []).join(',')));
  const linked_refs = toArray(prompt('Linked refs comma-separated', (existing?.linked_refs || []).join(',')));
  const description = prompt('Description', existing?.description || '') || '';
  const id = existing?.id || '';
  const payload = { title, owner, due_date, priority, tags, linked_refs, description };
  const url = id ? '/api/tasks/' + encodeURIComponent(id) : '/api/tasks';
  const method = id ? 'PATCH' : 'POST';
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!r.ok){ alert('Save failed'); return; }
  await loadBoard();
}

function openNewTask(){
  if (!hasBootstrapModal) return quickTaskFlow(null);
  document.getElementById('taskModalTitle').textContent = 'Create Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskForm').reset();
  document.getElementById('f_priority').value = 'P2';
  taskModal.show();
}

function openEditTask(id){
  const t = (boardData.tasks||[]).find(x=>x.id===id); if(!t) return;
  if (!hasBootstrapModal) return quickTaskFlow(t);
  document.getElementById('taskModalTitle').textContent = 'Edit Task';
  document.getElementById('taskId').value = id;
  document.getElementById('f_title').value = t.title || '';
  document.getElementById('f_owner').value = t.owner || '';
  document.getElementById('f_due_date').value = t.due_date || '';
  document.getElementById('f_priority').value = t.priority || 'P2';
  document.getElementById('f_tags').value = (t.tags||[]).join(',');
  document.getElementById('f_refs').value = (t.linked_refs||[]).join(',');
  document.getElementById('f_desc').value = t.description || '';
  taskModal.show();
}

async function saveTask(){
  const id = document.getElementById('taskId').value;
  const payload = {
    title: document.getElementById('f_title').value.trim(),
    owner: document.getElementById('f_owner').value.trim() || null,
    due_date: document.getElementById('f_due_date').value || null,
    priority: document.getElementById('f_priority').value,
    tags: toArray(document.getElementById('f_tags').value),
    linked_refs: toArray(document.getElementById('f_refs').value),
    description: document.getElementById('f_desc').value || ''
  };
  const url = id ? '/api/tasks/' + encodeURIComponent(id) : '/api/tasks';
  const method = id ? 'PATCH' : 'POST';
  const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  if(!r.ok){ alert('Save failed'); return; }
  if (taskModal) taskModal.hide();
  await loadBoard();
}

function openCommentModal(id){
  if (!hasBootstrapModal) {
    const text = prompt('Comment');
    if (text) fetch('/api/tasks/' + encodeURIComponent(id) + '/comment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) }).then(()=>loadBoard());
    return;
  }
  document.getElementById('commentTaskId').value = id;
  document.getElementById('commentText').value = '';
  commentModal.show();
}

async function saveComment(){
  const id = document.getElementById('commentTaskId').value;
  const text = document.getElementById('commentText').value.trim();
  if(!text) return;
  const r = await fetch('/api/tasks/' + encodeURIComponent(id) + '/comment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
  if(!r.ok){ alert('Comment failed'); return; }
  if (commentModal) commentModal.hide();
  await loadBoard();
}

async function requestApproval(id){
  const title = prompt('Optional review packet title (blank to skip)','') || '';
  const r = await fetch('/api/tasks/' + encodeURIComponent(id) + '/request-approval', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ create_review_packet: !!title, review_packet_title: title })});
  if(!r.ok){ alert('Request approval failed'); return; }
  await loadBoard();
}

async function approveTask(id){
  const r = await fetch('/api/tasks/' + encodeURIComponent(id) + '/approve', { method:'POST', headers:{'Content-Type':'application/json'}, body: '{}' });
  if(!r.ok){ alert('Approve failed'); return; }
  await loadBoard();
}

async function createInvite(){
  const role = prompt('Invite role (editor/observer/architect)','observer');
  const r = await fetch('/api/auth/invite', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ role })});
  const j = await r.json();
  if(!r.ok){ alert(j.error || 'Invite failed'); return; }
  prompt('Copy invite link', j.inviteUrl);
}

if(document.getElementById('newTaskBtn')) document.getElementById('newTaskBtn').addEventListener('click', openNewTask);
if(document.getElementById('saveTaskBtn')) document.getElementById('saveTaskBtn').addEventListener('click', saveTask);
if(document.getElementById('saveCommentBtn')) document.getElementById('saveCommentBtn').addEventListener('click', saveComment);
if(document.getElementById('inviteBtn')) document.getElementById('inviteBtn').addEventListener('click', createInvite);
loadBoard();
</script>
  </body></html>`);
});

app.get('/api/me', requireAnyAuth, async (req, res) => {
  res.json({ user: currentUser(req), effectiveRole: effectiveRole(req) });
});

app.post('/api/buyers', requireRole('architect','editor'), async (req, res) => {
  const buyersPath = path.join(ROOT, 'dashboard/data/buyers.json');
  const buyers = await readJson(buyersPath, []);

  const buyer_id = String(req.body.buyer_id || '').trim().toUpperCase();
  const name = String(req.body.name || '').trim();
  if (!buyer_id || !name) return res.status(400).send('buyer_id and name are required');
  if (buyers.some((b) => String(b.buyer_id || '').toUpperCase() === buyer_id)) {
    return res.status(409).send('buyer_id already exists');
  }

  const parseList = (v) => String(v || '').split(',').map((x) => x.trim()).filter(Boolean);
  const buyer = {
    buyer_id,
    name,
    type: String(req.body.type || 'Sovereign').trim(),
    mandate_summary: String(req.body.mandate_summary || '').trim(),
    geo_focus: parseList(req.body.geo_focus),
    sector_focus: parseList(req.body.sector_focus),
    score: Number.parseFloat(String(req.body.score || '1.0')) || 1.0,
    pressure_factors: {
      capital_deployment: 'Medium',
      regional_alignment: 'Medium',
      timing_urgency: 'Medium'
    },
    initiatives: []
  };

  buyers.push(buyer);
  await writeJson(buyersPath, buyers);
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'task.create', entity_type: 'buyer', entity_id: buyer_id, meta: { name } });
  res.redirect('/dashboard/buyers');
});

app.post('/api/initiatives/suggest', requireRole('architect','editor'), async (req, res) => {
  const buyer_id = String(req.body.buyer_id || '').trim().toUpperCase();
  const prompt = String(req.body.prompt || '').trim();
  const count = Math.min(10, Math.max(1, Number.parseInt(String(req.body.count || '5'), 10) || 5));

  const buyers = await readJson(path.join(ROOT, 'dashboard/data/buyers.json'), []);
  const initiatives = await readJson(path.join(ROOT, 'dashboard/data/initiatives.json'), []);
  const buyer = buyers.find((b) => String(b.buyer_id || '').toUpperCase() === buyer_id);
  if (!buyer) return res.status(404).json({ error: 'buyer not found' });

  const existing = new Set(initiatives.map((i) => String(i.name || '').toLowerCase()));

  let uosText = '';
  for (const key of ['execution-engine','canon','revenue-os']) {
    const dir = path.join(CURRENT_ROOT, key);
    if (!fssync.existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files.filter((x)=>x.endsWith('.md')).slice(0, 8)) {
      uosText += '\n' + await fs.readFile(path.join(dir,f), 'utf8').catch(()=> '');
    }
  }
  const u = uosText.toLowerCase();
  const flags = {
    energy: /energy|power|grid/.test(u),
    water: /water|desal|utility/.test(u),
    digital: /digital|data|fiber|ai/.test(u),
    housing: /housing|mortgage/.test(u),
    governance: /governance|fid|pre-fid|risk/.test(u),
  };

  const sector = (buyer.sector_focus || [])[0] || 'Infrastructure';
  const geo = (buyer.geo_focus || [])[0] || 'Regional';
  const baseIdeas = [
    `${geo} ${sector} Pre-FID Acceleration Platform`,
    `${geo} Utility Reliability Corridor`,
    `${geo} Capital Governance & Transparency Layer`,
    `${geo} Cross-Border Infrastructure Activation Program`,
    `${geo} Risk-Compressed Project Sequencing Framework`
  ];
  if (flags.energy && !baseIdeas.some(x=>/Energy/.test(x))) baseIdeas.unshift(`${geo} Energy Security Corridor`);
  if (flags.water) baseIdeas.push(`${geo} Water Security Platform`);
  if (flags.digital) baseIdeas.push(`${geo} Digital Infrastructure Backbone`);

  const ideas = [];
  let n = 1;
  for (const name of baseIdeas) {
    if (ideas.length >= count) break;
    if (existing.has(name.toLowerCase())) continue;
    const summary = [
      `Structure initiative for ${buyer.name} mandate alignment.`,
      `Focus on ${sector.toLowerCase()} deployment and pre-FID clarity.`,
      flags.governance ? 'Embed governance gates and risk allocation early.' : 'Define decision gates and capital sequencing.'
    ].join(' ');
    ideas.push({
      initiative_id: `INIT-${String(Date.now()).slice(-4)}${String(n).padStart(2,'0')}`,
      name,
      status: 'Pre-FID',
      macro_gravity_summary: (prompt ? `${prompt}. ` : '') + summary,
      linked_buyers: [buyer.buyer_id],
      presentations: {
        utc_internal: `presentations/PLACEHOLDER/decks/utc-internal/index.html`,
        buyer_alignment: { [buyer.buyer_id]: `presentations/PLACEHOLDER/decks/buyer-alignment/${buyer.buyer_id}/index.html` }
      }
    });
    n += 1;
  }

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'workflow.run', entity_type: 'initiative_suggestion', entity_id: buyer_id, meta: { count: ideas.length } });
  res.json({ buyer_id, ideas });
});

app.post('/api/initiatives', requireRole('architect','editor'), async (req, res) => {
  const initiativesPath = path.join(ROOT, 'dashboard/data/initiatives.json');
  const buyersPath = path.join(ROOT, 'dashboard/data/buyers.json');
  const initiatives = await readJson(initiativesPath, []);
  const buyers = await readJson(buyersPath, []);

  const payload = req.body || {};
  let initiative_id = String(payload.initiative_id || '').trim();
  const name = String(payload.name || '').trim();
  const status = String(payload.status || 'Pre-FID').trim();
  const macro_gravity_summary = String(payload.macro_gravity_summary || '').trim();
  const linked_buyers = Array.isArray(payload.linked_buyers) ? payload.linked_buyers : [payload.linked_buyers].filter(Boolean);
  if (!name || linked_buyers.length === 0) return res.status(400).send('name and linked_buyers are required');

  if (!initiative_id) {
    const next = initiatives.reduce((m, x) => {
      const mm = String(x.initiative_id || '').match(/^INIT-(\d+)/i);
      return mm ? Math.max(m, Number(mm[1])) : m;
    }, 0) + 1;
    initiative_id = `INIT-${String(next).padStart(3, '0')}`;
  }

  if (initiatives.some((i) => String(i.initiative_id || '').toUpperCase() === initiative_id.toUpperCase())) {
    return res.status(409).send('initiative_id already exists');
  }

  for (const b of linked_buyers) {
    if (!buyers.some((x) => x.buyer_id === b)) return res.status(400).send(`unknown buyer: ${b}`);
  }

  const initiative = {
    initiative_id,
    name,
    status,
    macro_gravity_summary,
    linked_buyers,
    presentations: {
      utc_internal: `presentations/${initiative_id}/decks/utc-internal/index.html`,
      buyer_alignment: Object.fromEntries(linked_buyers.map((b) => [b, `presentations/${initiative_id}/decks/buyer-alignment/${b}/index.html`]))
    }
  };

  initiatives.push(initiative);
  await writeJson(initiativesPath, initiatives);

  for (const b of buyers) {
    if (!Array.isArray(b.initiatives)) b.initiatives = [];
    if (linked_buyers.includes(b.buyer_id) && !b.initiatives.includes(initiative_id)) b.initiatives.push(initiative_id);
  }
  await writeJson(buyersPath, buyers);

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'task.create', entity_type: 'initiative', entity_id: initiative_id, meta: { name, linked_buyers } });
  res.json(initiative);
});

app.get('/api/board', requireAnyAuth, async (_req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  res.json(board);
});

app.post('/api/auth/invite', requireRole('architect'), async (req, res) => {
  const role = normalizedRole(String(req.body.role || 'observer'));
  if (!['architect', 'editor', 'observer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const token = crypto.randomBytes(20).toString('hex');
  const invite = { token, role, createdAt: nowIso(), createdBy: getUserLabel(req), expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() };
  data.invites.push(invite);
  await writeJson(TEAM_USERS_FILE, data);
  const inviteUrl = `https://claw.hiethel.ai/auth/invite/${token}`;
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'admin.invite.create', entity_type: 'user', entity_id: role, meta: { inviteUrl } });
  res.json({ inviteUrl, role, expiresAt: invite.expiresAt });
});

app.post('/api/tasks', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const body = sanitizeTaskPatch(req.body || {});
  if (!body.title) return res.status(400).json({ error: 'title required' });
  const task = {
    id: crypto.randomUUID(),
    title: body.title,
    status: 'Backlog',
    owner: body.owner || null,
    due_date: body.due_date || null,
    priority: BOARD_PRIORITIES.includes(body.priority) ? body.priority : 'P2',
    tags: body.tags || [],
    linked_refs: body.linked_refs || [],
    description: body.description || '',
    comments: [],
    request_approval: null,
    created_at: nowIso(),
    updated_at: nowIso(),
    created_by: getUserLabel(req),
    updated_by: getUserLabel(req),
  };
  board.tasks.push(task);
  await writeBoard(board, getUserLabel(req), 'task.create', task.id, null, task, effectiveRole(req) || 'editor');
  res.json(task);
});

app.patch('/api/tasks/:id', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const before = structuredClone(task);
  const patch = sanitizeTaskPatch(req.body || {});
  if (patch.priority && !BOARD_PRIORITIES.includes(patch.priority)) return res.status(400).json({ error: 'invalid priority' });
  Object.assign(task, patch);
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task.update', id, before, task, effectiveRole(req) || 'editor');
  res.json(task);
});

app.post('/api/tasks/:id/move', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const status = String(req.body.status || '');
  if (!BOARD_COLUMNS.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  if (status === 'Done' && !(task.request_approval && task.request_approval.approved)) {
    return res.status(400).json({ error: 'task cannot move to Done without approved RP' });
  }
  if (status === 'Ready for Review' && task.created_by !== getUserLabel(req) && !isArchitect(req)) {
    return res.status(403).json({ error: 'only creator can move Draft to Ready for Review' });
  }

  const before = { status: task.status, review_packet_id: task.review_packet_id || null };
  task.status = status;

  if (status === 'Ready for Review' && !task.review_packet_id) {
    const rp = await createReviewPacketStub({
      title: `${task.title} Review Packet`,
      linkedTaskId: task.id,
      createdBy: getUserLabel(req),
      status: 'Draft',
      recommendedAction: 'Approve',
    });
    task.review_packet_id = rp.rpId;
    task.request_approval = {
      requested_at: nowIso(),
      requested_by: getUserLabel(req),
      review_packet_stub: rp.path,
      approved: false,
      approved_by: null,
      approved_at: null,
    };
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.create', entity_type: 'review_packet', entity_id: rp.rpId, meta: { linked_task: task.id, path: rp.path } });
  }

  if (status === 'Ready for Review' && task.review_packet_id) {
    await updateRpFrontmatter(task.review_packet_id, { status: 'Ready for Review' });
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.ready_for_review', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  }

  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task.move', id, before, { status: task.status, review_packet_id: task.review_packet_id || null }, effectiveRole(req) || 'editor');
  res.json(task);
});

app.post('/api/tasks/:id/comment', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'comment text required' });
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const comment = { id: crypto.randomUUID(), author: getUserLabel(req), text, created_at: nowIso() };
  task.comments.push(comment);
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);
  await writeBoard(board, getUserLabel(req), 'task.comment', id, null, { comment }, effectiveRole(req) || 'editor');
  res.json(comment);
});

app.post('/api/tasks/:id/request-approval', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (task.created_by !== getUserLabel(req) && !isArchitect(req)) {
    return res.status(403).json({ error: 'only creator can move Draft to Ready for Review' });
  }

  let rpPath = null;
  if (!task.review_packet_id) {
    const rp = await createReviewPacketStub({
      title: String(req.body.review_packet_title || task.title || 'Review Packet'),
      linkedTaskId: task.id,
      createdBy: getUserLabel(req),
      status: 'Draft',
      recommendedAction: 'Approve',
    });
    task.review_packet_id = rp.rpId;
    rpPath = rp.path;
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.create', entity_type: 'review_packet', entity_id: rp.rpId, meta: { linked_task: task.id, path: rp.path } });
  }

  if (task.review_packet_id) {
    const updated = await updateRpFrontmatter(task.review_packet_id, { status: 'Ready for Review' });
    rpPath = rpPath || updated.path;
    await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'editor', event_type: 'rp.ready_for_review', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  }

  const before = { status: task.status, request_approval: task.request_approval || null, review_packet_id: task.review_packet_id || null };
  task.status = 'Ready for Review';
  task.request_approval = {
    requested_at: nowIso(),
    requested_by: getUserLabel(req),
    review_packet_stub: rpPath,
    approved: false,
    approved_by: null,
    approved_at: null,
  };
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task.move', id, before, { status: task.status, request_approval: task.request_approval, review_packet_id: task.review_packet_id || null }, effectiveRole(req) || 'editor');
  res.json(task);
});

app.post('/api/tasks/:id/approve', requireRole('architect'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  if (!task.review_packet_id) return res.status(400).json({ error: 'task has no review packet' });

  const before = { request_approval: task.request_approval || null, status: task.status };
  task.request_approval = {
    ...(task.request_approval || {}),
    approved: true,
    approved_by: getUserLabel(req),
    approved_at: nowIso(),
  };
  task.status = 'Done';
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await updateRpFrontmatter(task.review_packet_id, {
    status: 'Approved',
    architect_decision: 'Approve',
    architect_notes: String(req.body.architect_notes || 'Approved'),
  });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'rp.approve', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });

  await writeBoard(board, getUserLabel(req), 'task.move', id, before, { status: task.status, request_approval: task.request_approval }, effectiveRole(req) || 'architect');
  res.json(task);
});

app.post('/api/tasks/:id/reject', requireRole('architect'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });
  if (!task.review_packet_id) return res.status(400).json({ error: 'task has no review packet' });

  task.status = 'Blocked';
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);
  await updateRpFrontmatter(task.review_packet_id, {
    status: 'Rejected',
    architect_decision: 'Reject',
    architect_notes: String(req.body.architect_notes || 'Rejected'),
  });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'rp.reject', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  await writeBoard(board, getUserLabel(req), 'task.move', id, null, { status: task.status }, effectiveRole(req) || 'architect');
  res.json(task);
});

app.post('/api/tasks/:id/archive-rp', requireRole('architect'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task || !task.review_packet_id) return res.status(404).json({ error: 'not found' });
  await updateRpFrontmatter(task.review_packet_id, { status: 'Archived' });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: effectiveRole(req) || 'architect', event_type: 'rp.archive', entity_type: 'review_packet', entity_id: task.review_packet_id, meta: { linked_task: task.id } });
  await refreshBoardStateIntegration(board);
  await createSnapshot('rp.archive');
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', requireRole('architect', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const idx = board.tasks.findIndex((t) => t.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const before = board.tasks[idx];
  board.tasks.splice(idx, 1);
  await writeBoard(board, getUserLabel(req), 'task.delete', id, before, null, effectiveRole(req) || 'editor');
  res.json({ ok: true });
});

app.post('/api/review/:rpId/approve', requireRole('architect'), async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'rp not found' });

  const updated = await updateRpFrontmatter(rpId, {
    status: 'Approved',
    architect_decision: 'Approve',
    architect_notes: String(req.body.architect_notes || 'Approved'),
  });

  const board = await readJson(BOARD_FILE, defaultBoard());
  const t = board.tasks.find((x) => x.review_packet_id === rpId || x.id === rp.front.linked_task);
  if (t) {
    t.status = 'Done';
    t.request_approval = { ...(t.request_approval || {}), approved: true, approved_by: getUserLabel(req), approved_at: nowIso() };
    t.updated_at = nowIso();
    t.updated_by = getUserLabel(req);
    await writeJson(BOARD_FILE, board);
    await refreshBoardStateIntegration(board);
  }

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.approve', entity_type: 'review_packet', entity_id: rpId, meta: { path: updated.path } });
  await createSnapshot('rp.approve');
  res.json({ ok: true, rp_id: rpId, path: updated.path });
});

app.post('/api/review/:rpId/reject', requireRole('architect'), async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'rp not found' });
  const updated = await updateRpFrontmatter(rpId, {
    status: 'Rejected',
    architect_decision: 'Reject',
    architect_notes: String(req.body.architect_notes || 'Rejected'),
  });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.reject', entity_type: 'review_packet', entity_id: rpId, meta: { path: updated.path } });
  await createSnapshot('rp.reject');
  res.json({ ok: true });
});

app.post('/api/review/:rpId/archive', requireRole('architect'), async (req, res) => {
  const rpId = String(req.params.rpId || '').trim();
  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'rp not found' });
  const updated = await updateRpFrontmatter(rpId, { status: 'Archived' });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'rp.archive', entity_type: 'review_packet', entity_id: rpId, meta: { path: updated.path } });
  await createSnapshot('rp.archive');
  res.json({ ok: true });
});

async function copyDirContents(src, dst) {
  await fs.mkdir(dst, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) await copyDirContents(s, d);
    else await fs.copyFile(s, d);
  }
}

app.post('/api/events', requireRole('architect'), async (req, res) => {
  const event_type = String(req.body.event_type || '').trim();
  const allowed = ['workflow.run', 'workflow.fail', 'workflow.complete', 'cron.trigger', 'rp.ready_for_review', 'rp.approve', 'rp.reject', 'rp.archive', 'uos.upload', 'uos.publish', 'uos.archive', 'doctrine.change'];
  if (!allowed.includes(event_type)) return res.status(400).json({ error: 'unsupported event_type' });
  await appendAuditEvent({
    ts: nowIso(),
    actor: getUserLabel(req),
    role: effectiveRole(req) || 'architect',
    event_type,
    entity_type: String(req.body.entity_type || 'system'),
    entity_id: req.body.entity_id || null,
    meta: req.body.meta || {},
  });
  if (['rp.approve', 'uos.publish', 'doctrine.change', 'workflow.complete', 'workflow.fail'].includes(event_type)) {
    await createSnapshot(`event.${event_type}`);
  }
  res.json({ ok: true });
});

app.post('/api/uos/publish/:batch/:rpId', requireRole('architect'), async (req, res) => {
  const batch = String(req.params.batch || '');
  const rpId = String(req.params.rpId || '');
  const pendingDir = path.join(UOS_PENDING_ROOT, batch);
  if (!fssync.existsSync(pendingDir)) return res.status(404).json({ error: 'pending batch not found' });

  const rp = await parseRpFileById(rpId);
  if (!rp) return res.status(404).json({ error: 'review packet not found' });
  if ((rp.front.status || '') !== 'Approved') return res.status(400).json({ error: 'review packet must be Approved before publish' });

  for (const key of ['execution-engine', 'canon', 'revenue-os']) {
    const target = path.join(CURRENT_ROOT, key);
    await fs.rm(target, { recursive: true, force: true });
    const src = path.join(pendingDir, key);
    if (fssync.existsSync(src)) await copyDirContents(src, target);
  }

  // Build pseudo-updates from current
  const updates = [];
  for (const key of ['execution-engine', 'canon', 'revenue-os']) {
    const dir = path.join(CURRENT_ROOT, key);
    if (!fssync.existsSync(dir)) continue;
    const files = await fs.readdir(dir);
    for (const f of files.filter((x) => x.endsWith('.md'))) {
      updates.push({ key, originalName: f, currentPath: rel(path.join(dir, f)), inboxPath: null, archiveOriginalPath: null, archiveNormalizedPath: null });
    }
  }
  await rebuildUosIndex(updates, batch);

  const state = await readJson(DASHBOARD_STATE_FILE, { schemaVersion: 1 });
  state.latestUosPublish = nowIso();
  state.latestUosPublishedBatch = batch;
  await writeJson(DASHBOARD_STATE_FILE, state);

  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'uos.publish', entity_type: 'uos_batch', entity_id: `UOS-${batch}`, meta: { batch, rp_id: rpId } });
  await appendAuditEvent({ ts: nowIso(), actor: getUserLabel(req), role: 'architect', event_type: 'doctrine.change', entity_type: 'uos', entity_id: rpId, meta: { batch } });
  await createSnapshot('uos.publish');
  res.json({ ok: true, batch, rp_id: rpId });
});

function fieldNameToCanonical(field) {
  if (field === 'executionEngine') return 'execution-engine';
  if (field === 'canon') return 'canon';
  if (field === 'revenueOS') return 'revenue-os';
  return field;
}

async function normalizeToMarkdown(fieldPrefix, originalName, buffer) {
  const extension = ext(originalName);
  const ts = nowIso();
  const header = `# ${titleFromPrefix(fieldPrefix)}\n\n- Source file: ${originalName}\n- Normalized at: ${ts}\n\n---\n\n`;

  if (extension === '.md') {
    return header + buffer.toString('utf8');
  }

  if (extension === '.txt') {
    return header + '```text\n' + buffer.toString('utf8') + '\n```\n';
  }

  if (extension === '.pdf') {
    const parsed = await pdfParse(buffer);
    const body = parsed.text?.trim() || '(No extractable text)';
    return `${header}## Extracted from PDF\n\n${body}\n`;
  }

  if (extension === '.docx') {
    const parsed = await mammoth.extractRawText({ buffer });
    const body = (parsed.value || '').trim() || '(No extractable text)';
    return `${header}## Extracted from DOCX\n\n${body}\n`;
  }

  throw new Error(`Unsupported extension ${extension}`);
}

function titleFromPrefix(prefix) {
  if (prefix === 'execution-engine') return 'Execution Engine';
  if (prefix === 'canon') return 'Canon';
  if (prefix === 'revenue-os') return 'Revenue OS';
  return prefix;
}

async function rebuildUosIndex(updates, stamp) {
  const grouped = groupByCategory(updates);
  const lines = [];
  lines.push('# UOS Index');
  lines.push('');
  lines.push(`Last updated: ${nowIso()}`);
  lines.push(`Archive batch: \`${rel(path.join(ARCHIVE_ROOT, stamp))}\``);
  lines.push('');
  lines.push('## Current Documents');
  lines.push('');

  for (const [key, items] of Object.entries(grouped)) {
    lines.push(`### ${titleFromPrefix(key)}`);
    lines.push(`- Current folder: \`${rel(path.join(CURRENT_ROOT, key))}\``);
    lines.push(`- Files updated: ${items.length}`);
    for (const u of items) {
      lines.push(`  - Uploaded file: ${u.originalName}`);
      lines.push(`    - Current: \`${u.currentPath || u.pendingPath || 'N/A'}\``);
      lines.push(`    - Inbox copy: \`${u.inboxPath}\``);
      lines.push(`    - Archive original: \`${u.archiveOriginalPath}\``);
      lines.push(`    - Archive normalized: \`${u.archiveNormalizedPath}\``);
    }
    lines.push('');
  }

  await fs.writeFile(UOS_INDEX, lines.join('\n'), 'utf8');
}

async function rebuildDashboardState(updates, stamp) {
  const grouped = groupByCategory(updates);
  const state = {
    schemaVersion: 1,
    lastUpdated: nowIso(),
    updatedDocs: Object.keys(grouped).map((k) => titleFromPrefix(k)),
    uosCurrent: Object.fromEntries(
      Object.entries(grouped).map(([key, items]) => [key, {
        title: titleFromPrefix(key),
        currentDir: rel(path.join(CURRENT_ROOT, key)),
        fileCount: items.length,
        files: items.map((u) => ({
          currentPath: u.currentPath || u.pendingPath || null,
          sourceUpload: u.originalName,
          archiveOriginalPath: u.archiveOriginalPath,
          archiveNormalizedPath: u.archiveNormalizedPath,
        })),
      }])
    ),
    latestArchiveBatch: rel(path.join(ARCHIVE_ROOT, stamp)),
  };

  await fs.writeFile(DASHBOARD_STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  const snapshotPath = path.join(DASHBOARD_SNAPSHOTS, `${stamp}.json`);
  await fs.writeFile(snapshotPath, JSON.stringify(state, null, 2), 'utf8');

  const change = [
    `## ${state.lastUpdated}`,
    `- Rebuilt state from admin upload`,
    `- Updated docs: ${state.updatedDocs.join(', ')}`,
    `- Snapshot: \`${rel(snapshotPath)}\``,
    ''
  ].join('\n');

  if (!fssync.existsSync(DASHBOARD_CHANGELOG)) {
    await fs.writeFile(DASHBOARD_CHANGELOG, '# Dashboard State Changelog\n\n', 'utf8');
  }
  await fs.appendFile(DASHBOARD_CHANGELOG, change, 'utf8');
}

function groupByCategory(updates) {
  const out = {};
  for (const u of updates) {
    if (!out[u.key]) out[u.key] = [];
    out[u.key].push(u);
  }
  return out;
}

async function appendAdminLog(message) {
  const d = dateOnly();
  const logPath = path.join(ADMIN_LOG_ROOT, `${d}.md`);
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  const line = `- ${nowIso()} ${message}\n`;
  if (!fssync.existsSync(logPath)) {
    await fs.writeFile(logPath, `# Admin Actions — ${d}\n\n`, 'utf8');
  }
  await fs.appendFile(logPath, line, 'utf8');
}

function rel(p) {
  return path.relative(ROOT, p) || '.';
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

await ensureDirs();
await ensureTeamAndBoardFiles();

app.listen(ADMIN_PORT, ADMIN_HOST, () => {
  console.log(`UOS admin server listening on http://${ADMIN_HOST}:${ADMIN_PORT}`);
});
