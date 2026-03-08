import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { loadFromPackage } from './flowPlayerService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/player-package-sources';

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function normalizeRetentionPolicy(policy) {
  const p = String(policy || 'ephemeral_only');
  if (['ephemeral_only', 'retained_local_source', 'retained_package_copy', 'non_recoverable'].includes(p)) return p;
  return 'ephemeral_only';
}

export async function retainPackageSource({ sessionId, buffer, policy, originalFilename = null }) {
  const p = normalizeRetentionPolicy(policy);
  if (p === 'ephemeral_only' || p === 'non_recoverable') {
    return {
      sourceRetentionPolicy: p,
      packageSourceType: 'uploaded_temp',
      packageSourcePath: null,
      packageOriginalFilename: originalFilename,
      packageContentHash: sha256(buffer)
    };
  }

  await fs.mkdir(ROOT, { recursive: true });
  const out = path.join(ROOT, `${sessionId}.revealpkg.zip`);
  await fs.writeFile(out, buffer);
  return {
    sourceRetentionPolicy: p,
    packageSourceType: 'retained_copy',
    packageSourcePath: out,
    packageOriginalFilename: originalFilename,
    packageContentHash: sha256(buffer),
    retainedUntil: null
  };
}

export async function canRecoverFromSource(meta) {
  const p = normalizeRetentionPolicy(meta?.sourceRetentionPolicy);
  if (p === 'non_recoverable' || p === 'ephemeral_only') return { recoverable: false, reason: 'policy_non_recoverable' };
  if (!meta?.packageSourcePath) return { recoverable: false, reason: 'missing_source_path' };
  try {
    await fs.access(meta.packageSourcePath);
    return { recoverable: true };
  } catch {
    return { recoverable: false, reason: 'missing_source_file' };
  }
}

export async function rehydratePackageModel(meta) {
  const can = await canRecoverFromSource(meta);
  if (!can.recoverable) return { error: 'missing_source', reason: can.reason };
  const loaded = await loadFromPackage(meta.packageSourcePath);
  if (loaded.error) return { error: 'recovery_failed', reason: loaded.error };
  return loaded;
}
