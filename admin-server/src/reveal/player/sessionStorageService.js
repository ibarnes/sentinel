import fs from 'fs/promises';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/player-sessions';

function file(sessionId) {
  return path.join(ROOT, `${sessionId}.json`);
}

export async function ensureSessionStorage() {
  await fs.mkdir(ROOT, { recursive: true });
}

export async function writeSession(session) {
  await ensureSessionStorage();
  await fs.writeFile(file(session.sessionId), JSON.stringify(session, null, 2));
}

export async function readSession(sessionId) {
  try {
    return JSON.parse(await fs.readFile(file(sessionId), 'utf8'));
  } catch {
    return null;
  }
}

export async function deleteSessionFile(sessionId) {
  try { await fs.rm(file(sessionId), { force: true }); } catch {}
}
