import fs from 'fs/promises';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/player-recovery-registry';

function file(sessionId) {
  return path.join(ROOT, `${sessionId}.json`);
}

export async function upsertRecoveryRecord(record) {
  await fs.mkdir(ROOT, { recursive: true });
  const existing = await getRecoveryRecord(record.sessionId);
  const next = {
    ...(existing || {}),
    ...record,
    updatedAt: new Date().toISOString()
  };
  if (!next.createdAt) next.createdAt = next.updatedAt;
  await fs.writeFile(file(record.sessionId), JSON.stringify(next, null, 2));
  return next;
}

export async function getRecoveryRecord(sessionId) {
  try {
    return JSON.parse(await fs.readFile(file(sessionId), 'utf8'));
  } catch {
    return null;
  }
}

export async function setRecoveryAttempt(sessionId, status, recoveryError = null) {
  const existing = await getRecoveryRecord(sessionId);
  if (!existing) return null;
  return upsertRecoveryRecord({
    ...existing,
    lastRecoveryAttemptAt: new Date().toISOString(),
    lastRecoveryStatus: status,
    recoveryError,
    recoverabilityStatus: status === 'recovered' ? 'recoverable' : existing.recoverabilityStatus
  });
}
