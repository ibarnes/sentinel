import fs from 'fs/promises';
import fssync from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import crypto from 'crypto';
import { spawn } from 'child_process';

const WORKSPACE_ROOT = path.resolve(process.cwd());
const SERVER_ENTRY = path.join(WORKSPACE_ROOT, 'admin-server', 'src', 'server.js');
const SCRATCH_PASSWORD = 'sentinel-review-pass';
const SCRATCH_HASH = '$2a$10$QvuwMJfQ68oisHe08thsu.jpQXkKz117krECPTvPHxAe2ozMXg/SC';

function parseArgs(argv) {
  const out = { tasks: [], output: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--task') out.tasks.push(String(argv[i + 1] || '').trim());
    if (arg === '--output') out.output = String(argv[i + 1] || '').trim();
    if (arg === '--help') out.help = true;
  }
  return out;
}

function usage() {
  return [
    'Usage: node scripts/board/board-ui-readonly-harness.mjs --task TASK-0029 [--task TASK-0030] --output mission-control/artifacts/<file>.json',
    '',
    'Builds an isolated scratch root, starts a local admin server, logs in with a seeded',
    'team user, validates authenticated /api/board and /board?task=... responses, then',
    'writes a JSON receipt with the exact markers observed.'
  ].join('\n');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyRecursive(src, dest) {
  if (!fssync.existsSync(src)) return;
  await fs.cp(src, dest, { recursive: true, force: true });
}

async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((err) => {
        if (err) reject(err);
        else resolve(port);
      });
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    try {
      const response = await fetch(baseUrl + '/healthz');
      if (response.ok) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/healthz`);
}

function parseSetCookie(raw) {
  const chunks = Array.isArray(raw) ? raw : [raw];
  return chunks
    .filter(Boolean)
    .map((entry) => String(entry).split(';', 1)[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function login(baseUrl, username, password) {
  const body = new URLSearchParams({ username, password }).toString();
  const response = await fetch(baseUrl + '/auth/login', {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (response.status !== 302) {
    const text = await response.text().catch(() => '');
    throw new Error(`Login failed with status ${response.status}: ${text.slice(0, 240)}`);
  }
  const headers = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : response.headers.get('set-cookie');
  const cookie = parseSetCookie(headers);
  if (!cookie) throw new Error('Login succeeded without session cookie');
  return cookie;
}

function assertIncludes(haystack, needle, label, target) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} missing expected marker "${needle}" for ${target}`);
  }
}

async function seedScratchRoot(scratchRoot) {
  await ensureDir(scratchRoot);
  await copyRecursive(path.join(WORKSPACE_ROOT, 'dashboard'), path.join(scratchRoot, 'dashboard'));
  await copyRecursive(path.join(WORKSPACE_ROOT, 'mission-control', 'board'), path.join(scratchRoot, 'mission-control', 'board'));
  await copyRecursive(path.join(WORKSPACE_ROOT, 'mission-control', 'review-packets'), path.join(scratchRoot, 'mission-control', 'review-packets'));
  await copyRecursive(path.join(WORKSPACE_ROOT, 'mission-control', 'activity'), path.join(scratchRoot, 'mission-control', 'activity'));
  await ensureDir(path.join(scratchRoot, 'mission-control', 'auth'));
  await ensureDir(path.join(scratchRoot, 'mission-control', 'logs', 'admin-actions'));
  await ensureDir(path.join(scratchRoot, 'workspace', 'uos', 'current', 'execution-engine'));
  await ensureDir(path.join(scratchRoot, 'workspace', 'uos', 'current', 'canon'));
  await ensureDir(path.join(scratchRoot, 'workspace', 'uos', 'current', 'revenue-os'));
  await ensureDir(path.join(scratchRoot, 'workspace', 'uos', 'pending'));
  await ensureDir(path.join(scratchRoot, 'workspace', 'uos', 'archive'));
  const seededUsers = {
    users: [
      {
        id: crypto.randomUUID(),
        username: 'sentinel-reviewer',
        role: 'editor',
        passwordHash: SCRATCH_HASH,
        active: true,
        createdAt: new Date().toISOString(),
        invitedBy: 'sentinel'
      }
    ],
    invites: []
  };
  await fs.writeFile(
    path.join(scratchRoot, 'mission-control', 'auth', 'users.json'),
    JSON.stringify(seededUsers, null, 2) + '\n',
    'utf8'
  );
}

async function runHarness(tasks) {
  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const scratchRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'board-ui-harness-'));
  let child = null;
  try {
    await seedScratchRoot(scratchRoot);
    child = spawn(process.execPath, [SERVER_ENTRY], {
      cwd: WORKSPACE_ROOT,
      env: {
        ...process.env,
        OPENCLAW_DASHBOARD_ROOT: scratchRoot,
        ADMIN_HOST: '127.0.0.1',
        ADMIN_PORT: String(port),
        ADMIN_COOKIE_SECURE: 'false',
        ADMIN_SESSION_SECRET: 'sentinel-review-session-secret',
        ADMIN_PASSWORD_HASH: SCRATCH_HASH
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    await waitForHealth(baseUrl);
    const cookie = await login(baseUrl, 'sentinel-reviewer', SCRATCH_PASSWORD);
    const boardResponse = await fetch(baseUrl + '/api/board', { headers: { cookie } });
    if (!boardResponse.ok) {
      throw new Error(`/api/board failed with status ${boardResponse.status}`);
    }
    const boardJson = await boardResponse.json();
    const boardTasks = Array.isArray(boardJson?.tasks) ? boardJson.tasks : [];
    const results = [];
    for (const taskId of tasks) {
      const task = boardTasks.find((item) => String(item?.id || '') === taskId);
      if (!task) throw new Error(`Task ${taskId} missing from authenticated /api/board response`);
      const htmlResponse = await fetch(baseUrl + `/board?task=${encodeURIComponent(taskId)}`, {
        headers: { cookie }
      });
      if (!htmlResponse.ok) {
        throw new Error(`/board?task=${taskId} failed with status ${htmlResponse.status}`);
      }
      const html = await htmlResponse.text();
      const markers = [
        '.board-detail-rail',
        '.board-panel-backdrop',
        '?task=TASK-ID',
        'routeTaskId()',
        'syncTaskRoute(',
        'showTaskPanel()',
        'loadBoard()',
        'syncRequestApprovalState(task)',
        'Ready for Review gate:',
        'Done gate:'
      ];
      for (const marker of markers) {
        assertIncludes(html, marker, 'HTML contract', taskId);
      }
      results.push({
        task_id: taskId,
        title: task.title,
        status: task.status,
        ready_for_review_gate: task?.gate_status?.ready_for_review || null,
        done_gate: task?.gate_status?.done || null,
        html_markers: markers
      });
    }
    return {
      generated_at: new Date().toISOString(),
      scratch_root: scratchRoot,
      base_url: baseUrl,
      seeded_username: 'sentinel-reviewer',
      checks: {
        healthz: true,
        login: true,
        api_board: true
      },
      tasks: results,
      server_output: {
        stdout_tail: stdout.trim().split('\n').slice(-10),
        stderr_tail: stderr.trim().split('\n').slice(-10)
      }
    };
  } finally {
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await new Promise((resolve) => {
        child.once('exit', () => resolve());
        setTimeout(() => {
          if (!child.killed) child.kill('SIGKILL');
          resolve();
        }, 2000);
      });
    }
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.output || args.tasks.length === 0) {
  console.error(usage());
  process.exit(args.help ? 0 : 1);
}

const outputPath = path.resolve(WORKSPACE_ROOT, args.output);
await ensureDir(path.dirname(outputPath));
const receipt = await runHarness(args.tasks);
await fs.writeFile(outputPath, JSON.stringify(receipt, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({
  ok: true,
  output: path.relative(WORKSPACE_ROOT, outputPath),
  tasks: args.tasks
}, null, 2));
