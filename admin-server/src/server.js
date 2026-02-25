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
app.use('/dashboard', express.static(path.join(ROOT, 'dashboard'), {
  index: false,
  fallthrough: false,
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
<html><head><meta charset="utf-8"/><title>Admin Login</title>
<style>body{font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 16px}input,button{padding:8px;font-size:16px}label{display:block;margin:12px 0 6px}</style></head>
<body>
<h1>Sentinel Admin Login</h1>
<form method="post" action="/admin/login">
  <label>Password</label>
  <input type="password" name="password" required autofocus />
  <button type="submit">Login</button>
</form>
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
  return res.redirect('/admin/upload');
});

app.post('/admin/logout', requireAuth, async (req, res) => {
  const ip = req.ip || 'unknown';
  req.session.destroy(() => undefined);
  await appendAdminLog(`LOGOUT ip=${ip}`);
  res.redirect('/admin/login');
});

app.get('/admin/upload', requireAuth, (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"/><title>UOS Upload</title>
<style>
*{box-sizing:border-box}
body{font-family:sans-serif;max-width:1100px;margin:20px auto;padding:0 12px;line-height:1.35}
label{display:block;margin:10px 0 6px;font-weight:600}
input,button{font-size:16px}
input[type="file"]{width:100%}
button{padding:10px 14px;margin-top:14px;min-height:42px;cursor:pointer}
.card{border:1px solid #ddd;padding:14px;border-radius:12px}
.grid{display:grid;grid-template-columns:1fr;gap:12px}
.zone{border:2px dashed #bbb;border-radius:12px;padding:14px;background:#fafafa;min-width:0}
.zone.dragover{border-color:#2b6cb0;background:#edf2f7}
.muted{color:#555;font-size:14px}
.counter{display:inline-block;padding:2px 8px;border-radius:999px;background:#eef2ff;font-size:12px;margin-left:8px;vertical-align:middle}
.small{font-size:13px;color:#444;margin-top:6px;max-height:100px;overflow:auto;word-break:break-word}

/* Tablet and up */
@media (min-width: 760px){
  .card{padding:18px}
  .grid{grid-template-columns:1fr 1fr;gap:14px}
  .zone[data-input="revenueOS"]{grid-column:1 / -1}
}

/* Desktop */
@media (min-width: 1080px){
  .grid{grid-template-columns:1fr 1fr 1fr}
  .zone[data-input="revenueOS"]{grid-column:auto}
}

/* Small phones */
@media (max-width: 420px){
  body{padding:0 8px}
  h1{font-size:1.25rem}
  .counter{display:block;margin:6px 0 0 0;width:max-content}
  button{width:100%}
}
</style></head>
<body>
<h1>UOS Admin Upload</h1>
<div class="card">
  <p>Upload multiple docs per category (.md, .txt, .pdf, .docx), max 20MB each file.</p>
  <form id="uploadForm" method="post" action="/admin/upload" enctype="multipart/form-data">
    <div class="grid">
      <div class="zone" data-input="executionEngine">
        <label>Execution Engine <span class="counter" id="executionEngineCount">0 files</span></label>
        <input type="file" id="executionEngine" name="executionEngine" multiple required />
        <div class="muted">Drag & drop files here or use file picker.</div>
        <div class="small" id="executionEngineList"></div>
      </div>

      <div class="zone" data-input="canon">
        <label>Canon <span class="counter" id="canonCount">0 files</span></label>
        <input type="file" id="canon" name="canon" multiple required />
        <div class="muted">Drag & drop files here or use file picker.</div>
        <div class="small" id="canonList"></div>
      </div>

      <div class="zone" data-input="revenueOS">
        <label>Revenue OS <span class="counter" id="revenueOSCount">0 files</span></label>
        <input type="file" id="revenueOS" name="revenueOS" multiple required />
        <div class="muted">Drag & drop files here or use file picker.</div>
        <div class="small" id="revenueOSList"></div>
      </div>
    </div>

    <button type="submit">Upload + Rebuild Dashboard State</button>
  </form>
  <form method="post" action="/admin/logout"><button type="submit">Logout</button></form>
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

  const zone = document.querySelector('.zone[data-input="' + id + '"]');
  ['dragenter','dragover'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', (e) => {
    mergeFiles(input, e.dataTransfer.files);
  });
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

      res.type('html').send(`<!doctype html><html><body>
      <h2>Upload complete</h2>
      <p>State rebuilt and snapshot written.</p>
      <pre>${escapeHtml(JSON.stringify({ updatedCategories: [...new Set(updates.map((u) => u.key))], totalFiles: updates.length, archiveDir: rel(archiveDir), at: nowIso() }, null, 2))}</pre>
      <a href="/admin/upload">Upload again</a>
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
