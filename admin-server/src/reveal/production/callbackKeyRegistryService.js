import fs from 'fs/promises';
import path from 'path';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/callback-keys';
const FILE = path.join(ROOT, 'registry.json');

const DEFAULT_KEYS = [
  {
    callbackSigningKeyId: 'cbk_generic_default_v1',
    providerType: 'generic_renderer',
    providerProfileId: 'default',
    keyType: 'hmac_secret',
    algorithm: 'HMAC-SHA256',
    keyMaterialRef: 'inline',
    secret: 'generic-renderer-secret-v1',
    keyStatus: 'active',
    activatedAt: '2026-01-01T00:00:00.000Z',
    retiresAt: null,
    trustProfile: 'internal_verified',
    metadata: { deterministic: true }
  },
  {
    callbackSigningKeyId: 'cbk_generic_retired_v0',
    providerType: 'generic_renderer',
    providerProfileId: 'default',
    keyType: 'hmac_secret',
    algorithm: 'HMAC-SHA256',
    keyMaterialRef: 'inline',
    secret: 'generic-renderer-secret-old',
    keyStatus: 'retired',
    activatedAt: '2025-01-01T00:00:00.000Z',
    retiresAt: '2026-02-01T00:00:00.000Z',
    trustProfile: 'internal_verified',
    metadata: { deterministic: true }
  },
  {
    callbackSigningKeyId: 'cbk_generic_revoked_vx',
    providerType: 'generic_renderer',
    providerProfileId: 'default',
    keyType: 'hmac_secret',
    algorithm: 'HMAC-SHA256',
    keyMaterialRef: 'inline',
    secret: 'revoked-secret',
    keyStatus: 'revoked',
    activatedAt: '2024-01-01T00:00:00.000Z',
    retiresAt: null,
    trustProfile: 'production_verified',
    metadata: { deterministic: true }
  }
];

async function ensureRegistry() {
  await fs.mkdir(ROOT, { recursive: true });
  try { await fs.access(FILE); }
  catch { await fs.writeFile(FILE, JSON.stringify({ callbackKeys: DEFAULT_KEYS }, null, 2), 'utf8'); }
}

export async function listCallbackSigningKeys() {
  await ensureRegistry();
  const data = JSON.parse(await fs.readFile(FILE, 'utf8'));
  return { callbackKeys: data.callbackKeys || [] };
}

export async function listCallbackSigningKeysByProfile(providerType, providerProfileId = 'default') {
  const list = await listCallbackSigningKeys();
  return {
    callbackKeys: (list.callbackKeys || []).filter((k) => k.providerType === providerType && k.providerProfileId === providerProfileId)
  };
}

export async function resolveCallbackSigningKey({ callbackSigningKeyId, providerType, providerProfileId = 'default' }) {
  if (!callbackSigningKeyId || !/^[a-zA-Z0-9_.-]+$/.test(String(callbackSigningKeyId))) return { status: 'malformed_signing_key_id', key: null };
  const list = await listCallbackSigningKeysByProfile(providerType, providerProfileId);
  const key = (list.callbackKeys || []).find((k) => k.callbackSigningKeyId === callbackSigningKeyId) || null;
  if (!key) return { status: 'unknown_signing_key', key: null };
  if (key.keyStatus === 'revoked') return { status: 'revoked_signing_key', key };
  if (key.keyStatus === 'retired') return { status: 'retired_signing_key', key };
  return { status: 'resolved', key };
}
