import fs from 'fs/promises';
import path from 'path';
import { loadFromPackage } from './flowPlayerService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/player-packages';

export async function createPackagePlaybackFromBuffer(buffer) {
  const tmpZip = `/tmp/revealpkg-session-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`;
  await fs.writeFile(tmpZip, buffer);
  const loaded = await loadFromPackage(tmpZip);
  await fs.rm(tmpZip, { force: true });
  return loaded;
}

export async function cleanupPackageToken(token) {
  const dir = path.join(ROOT, token);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return { ok: true, status: 'cleaned' };
  } catch {
    return { ok: false, status: 'failed' };
  }
}
