#!/usr/bin/env node
import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace';
const DELTA = path.join(ROOT, 'mission-control/signal-pressure/out/pressure-delta.json');
const MAX_STALE_MS = Number(process.env.SIGNAL_PRESSURE_MAX_STALE_MS || 6 * 60 * 60 * 1000); // 6h default

async function statOrNull(p) {
  try { return await fs.stat(p); } catch { return null; }
}

async function main() {
  const st = await statOrNull(DELTA);
  const now = Date.now();
  const stale = !st || (now - st.mtimeMs) > MAX_STALE_MS;

  if (!stale) {
    console.log(JSON.stringify({ status: 'fresh', deltaPath: DELTA, ageMs: now - st.mtimeMs, maxStaleMs: MAX_STALE_MS }));
    return;
  }

  console.log(JSON.stringify({ status: 'stale_detected', deltaPath: DELTA, maxStaleMs: MAX_STALE_MS }));
  await fs.mkdir(path.join(ROOT, 'mission-control/signal-pressure/logs'), { recursive: true });

  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [path.join(ROOT, 'mission-control/signal-pressure/run-signal-pressure-monitor.mjs')], {
      cwd: ROOT,
      stdio: 'inherit'
    });
    p.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`run-signal-pressure-monitor exited ${code}`)));
    p.on('error', reject);
  });

  const after = await statOrNull(DELTA);
  console.log(JSON.stringify({ status: 'refreshed', deltaPath: DELTA, updatedAtMs: after?.mtimeMs || null }));
}

main().catch((e) => {
  console.error(JSON.stringify({ status: 'error', message: e.message }));
  process.exit(1);
});
