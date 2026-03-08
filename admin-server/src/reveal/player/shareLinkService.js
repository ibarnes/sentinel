import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { readSession } from './sessionStorageService.js';
import { loadFromFlow, loadFromSnapshot } from './flowPlayerService.js';
import { normalizeEmbedConfig } from './embedConfigService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/player-share-links';

function nowIso() { return new Date().toISOString(); }
function mkId() { return `sh_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`; }
function fileFor(shareId) { return path.join(ROOT, `${shareId}.json`); }

async function writeRecord(r) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(r.shareId), JSON.stringify(r, null, 2), 'utf8');
}

async function readRecord(shareId) {
  try { return JSON.parse(await fs.readFile(fileFor(shareId), 'utf8')); } catch { return null; }
}

async function listRecords() {
  await fs.mkdir(ROOT, { recursive: true });
  const names = await fs.readdir(ROOT);
  const out = [];
  for (const n of names) {
    if (!n.endsWith('.json')) continue;
    const r = await readRecord(n.replace(/\.json$/, ''));
    if (r) out.push(r);
  }
  return out.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function validateTarget(targetType, targetRef) {
  if (targetType === 'flow') {
    const loaded = await loadFromFlow(String(targetRef || ''));
    return loaded.error ? { ok: false, error: 'target_not_found' } : { ok: true };
  }
  if (targetType === 'snapshot') {
    const loaded = await loadFromSnapshot(null, String(targetRef || ''));
    return loaded.error ? { ok: false, error: 'target_not_found' } : { ok: true };
  }
  if (targetType === 'session') {
    const session = await readSession(String(targetRef || ''));
    return session ? { ok: true } : { ok: false, error: 'target_not_found' };
  }
  return { ok: false, error: 'invalid_target_type' };
}

export async function createShareLink({ targetType, targetRef, createdBy = null, expiresAt = null, accessMode = 'internal', embed = {}, playbackDefaults = {}, autoSession = true } = {}) {
  if (!['flow', 'snapshot', 'session'].includes(String(targetType || ''))) return { error: 'invalid_target_type' };
  if (!['internal', 'public_token'].includes(String(accessMode || ''))) return { error: 'invalid_access_mode' };
  const check = await validateTarget(String(targetType), String(targetRef || ''));
  if (!check.ok) return { error: check.error };

  const now = nowIso();
  const share = {
    shareId: mkId(),
    targetType: String(targetType),
    targetRef: String(targetRef),
    createdAt: now,
    createdBy,
    expiresAt: expiresAt || null,
    accessMode: String(accessMode),
    embed: normalizeEmbedConfig(embed || {}, 'standard_embed'),
    playbackDefaults: {
      step: Number(playbackDefaults?.step || 0),
      autoPlayEnabled: Boolean(playbackDefaults?.autoPlayEnabled || false),
      autoSession: Boolean(playbackDefaults?.autoSession ?? autoSession)
    },
    status: 'active',
    lastAccessAt: null,
    accessCount: 0
  };
  await writeRecord(share);
  return { share };
}

export async function getShareLink(shareId) {
  const share = await readRecord(String(shareId || ''));
  if (!share) return { error: 'share_not_found' };
  return { share };
}

function statusFor(share) {
  if (!share) return 'missing';
  if (share.status === 'revoked') return 'revoked';
  if (share.expiresAt && Date.parse(share.expiresAt) <= Date.now()) return 'expired';
  return 'active';
}

export async function resolveShareLink(shareId) {
  const out = await getShareLink(shareId);
  if (out.error) return out;
  const share = out.share;
  const effectiveStatus = statusFor(share);
  if (effectiveStatus !== 'active') return { error: effectiveStatus === 'revoked' ? 'share_revoked' : 'share_expired', share };

  share.lastAccessAt = nowIso();
  share.accessCount = Number(share.accessCount || 0) + 1;
  await writeRecord(share);
  return { share };
}

export async function patchShareLink(shareId, patch = {}) {
  const out = await getShareLink(shareId);
  if (out.error) return out;
  const share = out.share;

  if (patch.action === 'revoke') {
    share.status = 'revoked';
  }
  if (patch.expiresAt !== undefined) {
    share.expiresAt = patch.expiresAt || null;
  }
  if (patch.embed) {
    share.embed = normalizeEmbedConfig({ ...share.embed, ...patch.embed }, patch.embed.embedMode || share.embed.embedMode || 'standard_embed');
  }
  share.updatedAt = nowIso();
  await writeRecord(share);
  return { share };
}

export async function deleteShareLink(shareId) {
  const out = await getShareLink(shareId);
  if (out.error) return out;
  await fs.rm(fileFor(String(shareId || '')), { force: true });
  return { deleted: true };
}

export async function listShareLinks(filters = {}) {
  const all = await listRecords();
  const rows = all.filter((s) => {
    if (filters.targetType && s.targetType !== filters.targetType) return false;
    if (filters.targetRef && s.targetRef !== filters.targetRef) return false;
    if (filters.status) {
      const st = statusFor(s);
      if (st !== filters.status) return false;
    }
    return true;
  });
  return { shares: rows.map((s) => ({ ...s, status: statusFor(s) })) };
}
