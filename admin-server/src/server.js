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

const BOARD_COLUMNS = ['Backlog', 'Doing', 'Blocked', 'Ready for Review', 'Done'];
const BOARD_PRIORITIES = ['P0', 'P1', 'P2', 'P3'];

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
<link href="https://cdn.jsdelivr.net/npm/bootswatch@5.3.3/dist/lux/bootstrap.min.css" rel="stylesheet">
<style>
  .app-shell { max-width: 1100px; margin: 24px auto; padding: 0 12px; }
  .dropzone { border: 2px dashed var(--bs-border-color); border-radius: .75rem; padding: .9rem; background: var(--bs-tertiary-bg); }
  .dropzone.dragover { border-color: var(--bs-primary); background: color-mix(in srgb, var(--bs-primary) 8%, white); }
  .mono { font-family: ui-monospace,SFMono-Regular,Menlo,monospace; }
</style>`;
}

function adminNav(active = '') {
  const is = (k) => active === k ? 'active' : '';
  return `<nav class="navbar navbar-expand-lg bg-body-tertiary border rounded-3 px-3 mb-3">
    <a class="navbar-brand fw-bold" href="/admin">Sentinel Admin</a>
    <div class="navbar-nav me-auto">
      <a class="nav-link ${is('panel')}" href="/admin">Panel</a>
      <a class="nav-link ${is('upload')}" href="/admin/upload">Upload</a>
      <a class="nav-link" href="/dashboard/">Dashboard</a>
    </div>
    <form method="post" action="/admin/logout" class="d-flex m-0">
      <button class="btn btn-sm btn-outline-secondary" type="submit">Logout</button>
    </form>
  </nav>`;
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
    ACTIVITY_ROOT
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

function requireRole(...roles) {
  return (req, res, next) => {
    const u = currentUser(req);
    if (!u || !roles.includes(u.role)) return res.status(403).json({ error: 'forbidden' });
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

app.use('/dashboard', (req, res, next) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method not allowed');
  }
  return next();
});

app.get(['/dashboard', '/dashboard/'], async (_req, res) => {
  let state = null;
  try {
    state = JSON.parse(await fs.readFile(DASHBOARD_STATE_FILE, 'utf8'));
  } catch {}
  const updated = Array.isArray(state?.updatedDocs) ? state.updatedDocs.join(', ') : 'N/A';
  res.type('html').send(`<!doctype html>
<html><head>${uiHead('Dashboard (Read-Only)')}</head><body>
  <div class="app-shell" style="max-width:860px">
    <div class="card shadow-sm">
      <div class="card-body">
        <h3 class="card-title">Dashboard (Read-Only)</h3>
        <ul class="list-group list-group-flush mb-3">
          <li class="list-group-item d-flex justify-content-between"><span>Last updated</span><span class="mono small">${escapeHtml(state?.lastUpdated || 'N/A')}</span></li>
          <li class="list-group-item d-flex justify-content-between"><span>Updated docs</span><span>${escapeHtml(updated)}</span></li>
          <li class="list-group-item d-flex justify-content-between"><span>Archive batch</span><span class="mono small">${escapeHtml(state?.latestArchiveBatch || 'N/A')}</span></li>
        </ul>
        <div class="d-flex flex-wrap gap-2">
          <a class="btn btn-primary" href="/">Open Main App</a>
          <a class="btn btn-outline-secondary" href="/dashboard/state/state.json">View state.json</a>
          <a class="btn btn-outline-secondary" href="/dashboard/state/changelog.md">View changelog</a>
        </div>
        <p class="text-muted mt-3 mb-0">This route is intentionally read-only.</p>
      </div>
    </div>
  </div>
</body></html>`);
});

app.use('/dashboard', express.static(path.join(ROOT, 'dashboard'), {
  index: false,
  fallthrough: true,
  redirect: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

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
    return res.status(401).send('Invalid credentials');
  }

  resetLoginAttempts(ip);
  req.session.user = { scope: 'admin', username: 'admin', role: 'admin', loginAt: nowIso() };
  await appendAdminLog(`SUCCESS_LOGIN ip=${ip}`);
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

      for (const field of REQUIRED_FIELDS) {
        const key = fieldNameToCanonical(field);
        const currentCategoryDir = path.join(CURRENT_ROOT, key);
        await fs.rm(currentCategoryDir, { recursive: true, force: true });
        await fs.mkdir(currentCategoryDir, { recursive: true });
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

        const currentPath = path.join(CURRENT_ROOT, fieldPrefix, `${fileStem}.md`);
        const archiveNormalizedPath = path.join(archiveDir, `${fieldPrefix}__${fileStem}.md`);

        await fs.writeFile(currentPath, normalizedMarkdown, 'utf8');
        await fs.writeFile(archiveNormalizedPath, normalizedMarkdown, 'utf8');

        updates.push({
          field,
          key: fieldPrefix,
          originalName,
          extension,
          inboxPath: rel(inboxPath),
          currentPath: rel(currentPath),
          archiveOriginalPath: rel(archiveOriginalPath),
          archiveNormalizedPath: rel(archiveNormalizedPath),
        });
      }

      await rebuildUosIndex(updates, stamp);
      await rebuildDashboardState(updates, stamp);
      await appendAdminLog(`UPLOAD_SUCCESS count=${updates.length} files=${updates.map((u) => u.originalName).join(',')} archive=${rel(archiveDir)}`);

      res.type('html').send(`<!doctype html>
<html><head>${uiHead('Upload Complete')}</head><body>
<div class="app-shell" style="max-width:860px">
  ${adminNav('upload')}
  <div class="card shadow-sm">
    <div class="card-body">
      <h3 class="card-title">Upload complete</h3>
      <p class="text-muted">State rebuilt and snapshot written.</p>
      <pre class="p-3 bg-body-tertiary border rounded">${escapeHtml(JSON.stringify({ updatedCategories: [...new Set(updates.map((u) => u.key))], totalFiles: updates.length, archiveDir: rel(archiveDir), at: nowIso() }, null, 2))}</pre>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <a class="btn btn-primary" href="/dashboard/">View Dashboard</a>
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
  await appendJsonl(ACTIVITY_ROOT, event);
  await appendJsonl(BOARD_HISTORY_ROOT, event);
}

async function writeBoard(board, actor, action, taskId, before, after) {
  if (!boardValidator) await loadBoardValidator();
  const ok = boardValidator(board);
  if (!ok) {
    throw new Error('BOARD validation failed: ' + ajv.errorsText(boardValidator.errors));
  }
  await writeJson(BOARD_FILE, board);

  const event = {
    timestamp: nowIso(),
    actor,
    action,
    task_id: taskId || null,
    before: before || null,
    after: after || null,
  };
  await appendAuditEvent(event);
  await refreshBoardStateIntegration(board);
}

async function readRecentActivity(limit = 10) {
  const todayPath = path.join(ACTIVITY_ROOT, `${dateOnly()}.jsonl`);
  if (!fssync.existsSync(todayPath)) return [];
  const lines = (await fs.readFile(todayPath, 'utf8')).trim().split('\n').filter(Boolean);
  return lines.slice(-limit).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean).reverse();
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
    })),
    last10Activity: await readRecentActivity(10),
  };

  await writeJson(DASHBOARD_STATE_FILE, state);
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
  if (!user) return res.status(401).send('Invalid credentials');

  const ok = await bcrypt.compare(password, user.passwordHash || '');
  if (!ok) return res.status(401).send('Invalid credentials');

  clearAttempt(teamLoginAttempts, `team:${ip}`);
  req.session.user = { scope: 'team', username: user.username, role: user.role, loginAt: nowIso() };
  await appendAuditEvent({ timestamp: nowIso(), actor: user.username, action: 'login', task_id: null, before: null, after: null });
  return res.redirect('/board');
});

app.post('/auth/logout', requireAnyAuth, async (req, res) => {
  const actor = getUserLabel(req);
  req.session.destroy(() => undefined);
  await appendAuditEvent({ timestamp: nowIso(), actor, action: 'logout', task_id: null, before: null, after: null });
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
  await appendAuditEvent({ timestamp: nowIso(), actor: username, action: 'accept_invite', task_id: null, before: null, after: { role: user.role } });
  res.redirect('/auth/login');
});

app.get('/board', requireAnyAuth, async (_req, res) => {
  const u = _req.session.user;
  const canWrite = ['admin', 'editor'].includes(u.role);
  res.type('html').send(`<!doctype html><html><head>${uiHead('Task Board')}</head><body>
  <div class="app-shell">
    <nav class="navbar navbar-expand-lg bg-body-tertiary border rounded-3 px-3 mb-3">
      <a class="navbar-brand fw-bold" href="/board">Task Board</a>
      <div class="navbar-nav me-auto">
        <span class="nav-link disabled">${escapeHtml(u.username)} (${escapeHtml(u.role)})</span>
      </div>
      <form method="post" action="/auth/logout" class="d-flex m-0"><button class="btn btn-sm btn-outline-secondary" type="submit">Logout</button></form>
    </nav>

    <div class="d-flex flex-wrap gap-2 mb-3">
      ${canWrite ? '<button id="newTaskBtn" class="btn btn-primary">New Task</button>' : ''}
      ${u.role === 'admin' ? '<button id="inviteBtn" class="btn btn-outline-primary">Create Invite Link</button>' : ''}
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

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script>
const me = ${JSON.stringify(u)};
const canWrite = ${JSON.stringify(canWrite)};
const columns = ${JSON.stringify(BOARD_COLUMNS)};
let boardData = { tasks: [] };

const taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
const commentModal = new bootstrap.Modal(document.getElementById('commentModal'));

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
      ((me.role === 'admin' && t.request_approval && !t.request_approval.approved)
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
      '<div class="card-body" data-column="' + c + '" ondragover="allowDrop(event)" ondrop="dropTask(event,\'' + c + '\')">',
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

function openNewTask(){
  document.getElementById('taskModalTitle').textContent = 'Create Task';
  document.getElementById('taskId').value = '';
  document.getElementById('taskForm').reset();
  document.getElementById('f_priority').value = 'P2';
  taskModal.show();
}

function openEditTask(id){
  const t = (boardData.tasks||[]).find(x=>x.id===id); if(!t) return;
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
  taskModal.hide();
  await loadBoard();
}

function openCommentModal(id){
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
  commentModal.hide();
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
  const role = prompt('Invite role (editor/viewer/admin)','viewer');
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

app.get('/api/board', requireAnyAuth, async (_req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  res.json(board);
});

app.post('/api/auth/invite', requireRole('admin'), async (req, res) => {
  const role = String(req.body.role || 'viewer');
  if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'invalid role' });
  const data = await readJson(TEAM_USERS_FILE, defaultUsers());
  const token = crypto.randomBytes(20).toString('hex');
  const invite = { token, role, createdAt: nowIso(), createdBy: getUserLabel(req), expiresAt: new Date(Date.now() + 7*24*60*60*1000).toISOString() };
  data.invites.push(invite);
  await writeJson(TEAM_USERS_FILE, data);
  const inviteUrl = `https://claw.hiethel.ai/auth/invite/${token}`;
  await appendAuditEvent({ timestamp: nowIso(), actor: getUserLabel(req), action: 'create_invite', task_id: null, before: null, after: { role, inviteUrl } });
  res.json({ inviteUrl, role, expiresAt: invite.expiresAt });
});

app.post('/api/tasks', requireRole('admin', 'editor'), async (req, res) => {
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
  await writeBoard(board, getUserLabel(req), 'task_create', task.id, null, task);
  res.json(task);
});

app.patch('/api/tasks/:id', requireRole('admin', 'editor'), async (req, res) => {
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

  await writeBoard(board, getUserLabel(req), 'task_update', id, before, task);
  res.json(task);
});

app.post('/api/tasks/:id/move', requireRole('admin', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const status = String(req.body.status || '');
  if (!BOARD_COLUMNS.includes(status)) return res.status(400).json({ error: 'invalid status' });
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const before = { status: task.status };
  task.status = status;
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task_move', id, before, { status: task.status });
  res.json(task);
});

app.post('/api/tasks/:id/comment', requireRole('admin', 'editor'), async (req, res) => {
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
  await writeBoard(board, getUserLabel(req), 'task_comment', id, null, { comment });
  res.json(comment);
});

app.post('/api/tasks/:id/request-approval', requireRole('admin', 'editor'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const createStub = Boolean(req.body.create_review_packet);
  const rpTitle = String(req.body.review_packet_title || '').trim();
  let rpPath = null;
  if (createStub) {
    const stamp = tsForPath();
    const slug = safeName((rpTitle || task.title).slice(0, 80)).replace(/_+/g, '_');
    rpPath = path.join(ROOT, 'mission-control', 'review-packets', `RP-STUB-${stamp}-${slug}.md`);
    const content = `# Review Packet Stub\n\n- Created: ${nowIso()}\n- Requested by: ${getUserLabel(req)}\n- Linked task: ${task.id}\n- Title: ${rpTitle || task.title}\n\n## Draft\n\n(complete this review packet)\n`;
    await fs.writeFile(rpPath, content, 'utf8');
  }

  const before = { status: task.status, request_approval: task.request_approval || null };
  task.status = 'Ready for Review';
  task.request_approval = {
    requested_at: nowIso(),
    requested_by: getUserLabel(req),
    review_packet_stub: rpPath ? rel(rpPath) : null,
    approved: false,
    approved_by: null,
    approved_at: null,
  };
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);

  await writeBoard(board, getUserLabel(req), 'task_request_approval', id, before, { status: task.status, request_approval: task.request_approval });
  res.json(task);
});

app.post('/api/tasks/:id/approve', requireRole('admin'), async (req, res) => {
  const board = await readJson(BOARD_FILE, defaultBoard());
  const id = String(req.params.id);
  const task = board.tasks.find((t) => t.id === id);
  if (!task) return res.status(404).json({ error: 'not found' });

  const before = { request_approval: task.request_approval || null };
  task.request_approval = {
    ...(task.request_approval || {}),
    approved: true,
    approved_by: getUserLabel(req),
    approved_at: nowIso(),
  };
  task.updated_at = nowIso();
  task.updated_by = getUserLabel(req);
  await writeBoard(board, getUserLabel(req), 'task_approve_review_packet', id, before, { request_approval: task.request_approval });
  res.json(task);
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
      lines.push(`    - Current: \`${u.currentPath}\``);
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
          currentPath: u.currentPath,
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
