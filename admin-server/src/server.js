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
    ADMIN_LOG_ROOT
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

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  return res.redirect('/admin/login');
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
  req.session.authenticated = true;
  req.session.loginAt = nowIso();
  await appendAdminLog(`SUCCESS_LOGIN ip=${ip}`);
  return res.redirect('/admin');
});

app.post('/admin/logout', requireAuth, async (req, res) => {
  const ip = req.ip || 'unknown';
  req.session.destroy(() => undefined);
  await appendAdminLog(`LOGOUT ip=${ip}`);
  res.redirect('/admin/login');
});

app.get('/admin', requireAuth, async (_req, res) => {
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

app.get('/admin/upload', requireAuth, (_req, res) => {
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
  requireAuth,
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

app.listen(ADMIN_PORT, ADMIN_HOST, () => {
  console.log(`UOS admin server listening on http://${ADMIN_HOST}:${ADMIN_PORT}`);
});
