import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage';
const PATHS = {
  sessions: path.join(ROOT, 'sessions'),
  rawEvents: path.join(ROOT, 'raw-events'),
  normalizedFlows: path.join(ROOT, 'normalized-flows'),
  reviewedFlows: path.join(ROOT, 'reviewed-flows'),
  assets: path.join(ROOT, 'assets')
};

export async function ensureRevealStorage() {
  await Promise.all(Object.values(PATHS).map((p) => fs.mkdir(p, { recursive: true })));
}

export function newId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

export function fileForSession(sessionId) {
  return path.join(PATHS.sessions, `${sessionId}.json`);
}

export function fileForRawEvents(sessionId) {
  return path.join(PATHS.rawEvents, `${sessionId}.jsonl`);
}

export function fileForNormalizedFlow(flowId) {
  return path.join(PATHS.normalizedFlows, `${flowId}.json`);
}

export function fileForReviewedFlow(flowId) {
  return path.join(PATHS.reviewedFlows, `${flowId}.json`);
}

export function assetPath(sessionId, stepId, kind) {
  return path.join(PATHS.assets, sessionId, stepId, `${kind}.jpg`);
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

export async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function appendJsonl(filePath, rows) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  await fs.appendFile(filePath, payload, 'utf8');
}

export async function writeDataUrlAsset(filePath, dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return false;
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/i);
  if (!match) return false;
  const b64 = match[2];
  const buf = Buffer.from(b64, 'base64');
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
  return true;
}

export async function readJsonl(filePath) {
  try {
    const txt = await fs.readFile(filePath, 'utf8');
    return txt.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

export { PATHS };
