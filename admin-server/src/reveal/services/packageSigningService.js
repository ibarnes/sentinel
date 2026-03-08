import fs from 'fs/promises';
import crypto from 'crypto';

const DEFAULT_PRIVATE = '/home/ec2-user/.openclaw/workspace/reveal/keys/package-signing-private.pem';
const DEFAULT_PUBLIC = '/home/ec2-user/.openclaw/workspace/reveal/keys/package-signing-public.pem';
const DEFAULT_KEYSET_PRIVATE = '/home/ec2-user/.openclaw/workspace/reveal/keys/keyset-signing-private.pem';
const DEFAULT_KEYSET_PUBLIC = '/home/ec2-user/.openclaw/workspace/reveal/keys/keyset-signing-public.pem';
const KEYSET_CHAIN_PATH = '/home/ec2-user/.openclaw/workspace/reveal/storage/verification/keyset-chain.json';

export const PACKAGE_SIGNATURE_VERSION = 'sig-v1';
export const KEYSET_SIGNATURE_VERSION = 'keyset-sig-v1';
export const KEYSET_HASH_VERSION = 'sha256-v1';
export const VERIFICATION_POLICY_VERSION = 'policy-v1';

export const TRUST_PROFILES = {
  local_dev: { trustProfileId: 'local_dev', trustProfileName: 'Local Development', trustProfileVersion: 1, trustProfileType: 'local_dev', signerIdentity: 'Reveal Local Signer', verificationPolicyVersion: VERIFICATION_POLICY_VERSION },
  internal_verified: { trustProfileId: 'internal_verified', trustProfileName: 'Internal Verified', trustProfileVersion: 1, trustProfileType: 'internal_verified', signerIdentity: 'Reveal Internal Signer', verificationPolicyVersion: VERIFICATION_POLICY_VERSION },
  unsigned_export: { trustProfileId: 'unsigned_export', trustProfileName: 'Unsigned Export', trustProfileVersion: 1, trustProfileType: 'unsigned_export', signerIdentity: 'None', verificationPolicyVersion: VERIFICATION_POLICY_VERSION }
};

function canonicalize(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.map(canonicalize).filter((x) => x !== undefined);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const cv = canonicalize(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return undefined;
}

async function readIfExists(p) { try { return await fs.readFile(p, 'utf8'); } catch { return null; } }
function sha256(v) { return crypto.createHash('sha256').update(v).digest('hex'); }
function fp(pub) { return pub ? sha256(pub) : null; }

function parseAdditionalKeys() {
  try {
    const raw = process.env.REVEAL_ADDITIONAL_KEYS_JSON;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function selectedProfile(enabled) {
  if (!enabled) return TRUST_PROFILES.unsigned_export;
  const wanted = String(process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev');
  return TRUST_PROFILES[wanted] || TRUST_PROFILES.local_dev;
}

function lifecycleForPrimaryKey() {
  return {
    keyStatus: process.env.REVEAL_SIGNING_KEY_STATUS || 'active',
    activatedAt: process.env.REVEAL_SIGNING_KEY_ACTIVATED_AT || null,
    retiresAt: process.env.REVEAL_SIGNING_KEY_RETIRES_AT || null,
    revokedAt: process.env.REVEAL_SIGNING_KEY_REVOKED_AT || null,
    previousKeyId: process.env.REVEAL_SIGNING_PREVIOUS_KEY_ID || null,
    nextKeyId: process.env.REVEAL_SIGNING_NEXT_KEY_ID || null,
    rotationGroupId: process.env.REVEAL_SIGNING_ROTATION_GROUP_ID || 'default',
    verificationUse: process.env.REVEAL_SIGNING_VERIFICATION_USE || 'both'
  };
}

function validateLifecycle(keys = []) {
  const reasonCodes = [];
  const byId = new Set();
  const fpSet = new Set();

  for (const k of keys) {
    if (!k.signingKeyId) reasonCodes.push('missing_signing_key_id');
    if (byId.has(k.signingKeyId)) reasonCodes.push('duplicate_signing_key_id');
    byId.add(k.signingKeyId);

    if (k.signerKeyFingerprint) {
      if (fpSet.has(k.signerKeyFingerprint)) reasonCodes.push('conflicting_signer_fingerprints');
      fpSet.add(k.signerKeyFingerprint);
    }

    if (k.keyStatus === 'revoked' && !k.revokedAt) reasonCodes.push('revoked_key_missing_revoked_at');
    if (k.keyStatus === 'active' && k.revokedAt) reasonCodes.push('revoked_key_marked_active');

    if (k.activatedAt && k.retiresAt && Date.parse(k.activatedAt) > Date.parse(k.retiresAt)) reasonCodes.push('malformed_rotation_window');
    if (k.retiresAt && k.revokedAt && Date.parse(k.retiresAt) > Date.parse(k.revokedAt)) reasonCodes.push('malformed_rotation_window');
  }

  const activeKeys = keys.filter((k) => k.keyStatus === 'active');
  if (activeKeys.length > 1) reasonCodes.push('conflicting_active_keys');

  return { ok: reasonCodes.length === 0, reasonCodes };
}

export async function getSigningContext() {
  const privateKey = process.env.REVEAL_SIGNING_PRIVATE_KEY || await readIfExists(DEFAULT_PRIVATE);
  const publicKey = process.env.REVEAL_SIGNING_PUBLIC_KEY || await readIfExists(DEFAULT_PUBLIC);
  const enabled = Boolean(privateKey && publicKey);
  const trustProfile = selectedProfile(enabled);

  if (!enabled) return { enabled: false, unsignedReason: 'missing_key', trustProfile, verificationPolicyVersion: VERIFICATION_POLICY_VERSION };

  const signingAlgorithm = 'RSA-SHA256';
  const publicKeyAlgorithm = 'RSA';
  const signingKeyId = process.env.REVEAL_SIGNING_KEY_ID || fp(publicKey).slice(0, 16);
  const signerKeyFingerprint = fp(publicKey);

  return {
    enabled: true,
    privateKey,
    publicKey,
    signingAlgorithm,
    publicKeyAlgorithm,
    signingKeyId,
    signerKeyFingerprint,
    publicKeyHint: signerKeyFingerprint?.slice(0, 12) || null,
    trustProfile,
    verificationPolicyVersion: VERIFICATION_POLICY_VERSION,
    lifecycle: lifecycleForPrimaryKey()
  };
}

async function getKeysetSigningContext() {
  const privateKey = process.env.REVEAL_KEYSET_SIGNING_PRIVATE_KEY || await readIfExists(DEFAULT_KEYSET_PRIVATE) || process.env.REVEAL_SIGNING_PRIVATE_KEY || await readIfExists(DEFAULT_PRIVATE);
  const publicKey = process.env.REVEAL_KEYSET_SIGNING_PUBLIC_KEY || await readIfExists(DEFAULT_KEYSET_PUBLIC) || process.env.REVEAL_SIGNING_PUBLIC_KEY || await readIfExists(DEFAULT_PUBLIC);
  if (!privateKey || !publicKey) return { enabled: false, unsignedReason: 'missing_keyset_signing_key' };
  return {
    enabled: true,
    privateKey,
    publicKey,
    keysetSigningAlgorithm: 'RSA-SHA256',
    keysetSigningKeyId: process.env.REVEAL_KEYSET_SIGNING_KEY_ID || fp(publicKey).slice(0, 16)
  };
}

function keysetCanonicalPayload(keyset) {
  return canonicalize({
    trustProfiles: keyset.trustProfiles,
    keys: keyset.keys,
    keysetContentHash: keyset.keysetContentHash,
    keysetHashVersion: keyset.keysetHashVersion,
    keysetVersion: keyset.keysetVersion,
    previousKeysetVersion: keyset.previousKeysetVersion,
    previousKeysetHash: keyset.previousKeysetHash,
    keysetChainIndex: keyset.keysetChainIndex
  });
}

function computeKeysetContentHash(keysetDraft) {
  const content = canonicalize({ trustProfiles: keysetDraft.trustProfiles, keys: keysetDraft.keys });
  return { hash: sha256(JSON.stringify(content)), content };
}

async function readKeysetChain() {
  try {
    return JSON.parse(await fs.readFile(KEYSET_CHAIN_PATH, 'utf8'));
  } catch {
    return { chain: [] };
  }
}

async function writeKeysetChain(data) {
  await fs.mkdir('/home/ec2-user/.openclaw/workspace/reveal/storage/verification', { recursive: true });
  await fs.writeFile(KEYSET_CHAIN_PATH, JSON.stringify(data, null, 2));
}

function keyFromCtx(ctx) {
  if (!ctx.enabled) return null;
  return {
    signingKeyId: ctx.signingKeyId,
    signerKeyFingerprint: ctx.signerKeyFingerprint,
    algorithm: ctx.signingAlgorithm,
    publicKeyAlgorithm: ctx.publicKeyAlgorithm,
    publicKeyPem: ctx.publicKey,
    trustProfileId: ctx.trustProfile.trustProfileId,
    trustProfileName: ctx.trustProfile.trustProfileName,
    status: ctx.lifecycle.keyStatus,
    keyStatus: ctx.lifecycle.keyStatus,
    activatedAt: ctx.lifecycle.activatedAt,
    retiresAt: ctx.lifecycle.retiresAt,
    revokedAt: ctx.lifecycle.revokedAt,
    previousKeyId: ctx.lifecycle.previousKeyId,
    nextKeyId: ctx.lifecycle.nextKeyId,
    rotationGroupId: ctx.lifecycle.rotationGroupId,
    verificationUse: ctx.lifecycle.verificationUse,
    keyHint: ctx.publicKeyHint
  };
}

function normalizeAdditionalKey(k) {
  return {
    signingKeyId: k.signingKeyId,
    signerKeyFingerprint: k.signerKeyFingerprint,
    algorithm: k.algorithm || 'RSA-SHA256',
    publicKeyAlgorithm: k.publicKeyAlgorithm || 'RSA',
    publicKeyPem: k.publicKeyPem || null,
    trustProfileId: k.trustProfileId || 'internal_verified',
    trustProfileName: TRUST_PROFILES[k.trustProfileId || 'internal_verified']?.trustProfileName || 'Internal Verified',
    status: k.keyStatus || k.status || 'retired',
    keyStatus: k.keyStatus || k.status || 'retired',
    activatedAt: k.activatedAt || null,
    retiresAt: k.retiresAt || null,
    revokedAt: k.revokedAt || null,
    previousKeyId: k.previousKeyId || null,
    nextKeyId: k.nextKeyId || null,
    rotationGroupId: k.rotationGroupId || 'default',
    verificationUse: k.verificationUse || 'package_signing',
    keyHint: k.keyHint || null
  };
}

async function buildCurrentKeysetDraft() {
  const ctx = await getSigningContext();
  const keys = [];
  const primary = keyFromCtx(ctx);
  if (primary) keys.push(primary);
  for (const k of parseAdditionalKeys()) keys.push(normalizeAdditionalKey(k));

  const draft = { trustProfiles: Object.values(TRUST_PROFILES), keys };
  const lifecycleValidation = validateLifecycle(keys);
  return { draft, lifecycleValidation };
}

async function signKeyset(keyset) {
  const sctx = await getKeysetSigningContext();
  if (!sctx.enabled) {
    return {
      keysetSignatureStatus: 'unsigned',
      keysetSignature: null,
      keysetSignatureVersion: KEYSET_SIGNATURE_VERSION,
      keysetSigningKeyId: null,
      keysetSigningAlgorithm: 'RSA-SHA256',
      unsignedReason: sctx.unsignedReason
    };
  }

  const payload = JSON.stringify(keysetCanonicalPayload(keyset));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(payload);
  signer.end();
  const sig = signer.sign(sctx.privateKey, 'base64');
  return {
    keysetSignatureStatus: 'signed',
    keysetSignature: sig,
    keysetSignatureVersion: KEYSET_SIGNATURE_VERSION,
    keysetSigningKeyId: sctx.keysetSigningKeyId,
    keysetSigningAlgorithm: sctx.keysetSigningAlgorithm,
    keysetSigningPublicKey: sctx.publicKey
  };
}

function verifyKeysetSignature(keyset) {
  if (!keyset.keysetSignature) return { status: 'missing_signature', reasonCodes: ['missing_keyset_signature'] };
  if (!keyset.keysetSigningPublicKey) return { status: 'missing_keyset_signing_key', reasonCodes: ['missing_keyset_signing_public_key'] };
  if (keyset.keysetSignatureVersion !== KEYSET_SIGNATURE_VERSION) return { status: 'invalid_signature', reasonCodes: ['incompatible_keyset_signature_version'] };

  const payload = JSON.stringify(keysetCanonicalPayload(keyset));
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(payload);
  verifier.end();
  const ok = verifier.verify(keyset.keysetSigningPublicKey, keyset.keysetSignature, 'base64');
  return ok ? { status: 'verified', reasonCodes: ['keyset_signature_verified'] } : { status: 'invalid_signature', reasonCodes: ['keyset_signature_verification_failed'] };
}

export async function getVerificationKeyset() {
  const { draft, lifecycleValidation } = await buildCurrentKeysetDraft();
  const chainStore = await readKeysetChain();
  const latest = chainStore.chain?.[chainStore.chain.length - 1] || null;

  const hash = computeKeysetContentHash(draft).hash;
  if (latest && latest.keysetContentHash === hash) return latest;

  const nextIndex = (latest?.keysetChainIndex || 0) + 1;
  const keyset = {
    keysetVersion: `keyset-v1.${nextIndex}`,
    publishedAt: new Date().toISOString(),
    previousKeysetVersion: latest?.keysetVersion || null,
    previousKeysetHash: latest?.keysetContentHash || null,
    keysetChainIndex: nextIndex,
    keysetHashVersion: KEYSET_HASH_VERSION,
    keysetContentHash: hash,
    trustProfiles: draft.trustProfiles,
    keys: draft.keys,
    lifecycleValidation: {
      ok: lifecycleValidation.ok,
      reasonCodes: lifecycleValidation.reasonCodes
    }
  };

  Object.assign(keyset, await signKeyset(keyset));
  const sigVerify = verifyKeysetSignature(keyset);
  if (keyset.keysetSignatureStatus === 'signed' && sigVerify.status !== 'verified') keyset.keysetSignatureStatus = 'verification_failed';

  chainStore.chain = chainStore.chain || [];
  chainStore.chain.push(keyset);
  await writeKeysetChain(chainStore);
  return keyset;
}

export async function verifyKeysetIntegrity(keyset = null) {
  const ks = keyset || await getVerificationKeyset();
  const reasonCodes = [];

  const recomputed = computeKeysetContentHash(ks).hash;
  if (recomputed !== ks.keysetContentHash) reasonCodes.push('keyset_hash_mismatch');

  if (ks.previousKeysetVersion || ks.previousKeysetHash) {
    const chain = await readKeysetChain();
    const prev = (chain.chain || []).find((x) => x.keysetVersion === ks.previousKeysetVersion);
    if (!prev || prev.keysetContentHash !== ks.previousKeysetHash) reasonCodes.push('broken_previous_keyset_link');
  }

  const lifecycle = validateLifecycle(ks.keys || []);
  if (!lifecycle.ok) reasonCodes.push(...lifecycle.reasonCodes);

  const sig = ks.keysetSignatureStatus === 'unsigned'
    ? { status: 'unsigned', reasonCodes: ['unsigned_keyset'] }
    : verifyKeysetSignature(ks);

  if (sig.status !== 'verified' && sig.status !== 'unsigned') reasonCodes.push(...sig.reasonCodes);
  if (sig.status === 'unsigned' && ks.keysetSignatureStatus !== 'unsigned') reasonCodes.push('missing_signature');

  const status = reasonCodes.length
    ? (reasonCodes.includes('keyset_hash_mismatch') ? 'keyset_hash_mismatch'
      : reasonCodes.includes('broken_previous_keyset_link') ? 'broken_previous_keyset_link'
      : reasonCodes.includes('conflicting_active_keys') ? 'conflicting_active_keys'
      : reasonCodes.includes('malformed_rotation_window') ? 'malformed_rotation_window'
      : reasonCodes.includes('missing_keyset_signing_public_key') ? 'missing_keyset_signing_key'
      : sig.status === 'unsigned' ? 'unsigned'
      : 'invalid_signature')
    : (sig.status === 'unsigned' ? 'unsigned' : 'verified');

  return {
    status,
    reasonCodes,
    keysetVersion: ks.keysetVersion,
    keysetChainIndex: ks.keysetChainIndex,
    keysetContentHash: ks.keysetContentHash,
    recomputedKeysetContentHash: recomputed,
    keysetSignatureStatus: ks.keysetSignatureStatus,
    keysetSignatureVersion: ks.keysetSignatureVersion,
    keysetSigningKeyId: ks.keysetSigningKeyId
  };
}

export function buildSigningPayload(manifestCore) {
  return canonicalize({
    packageFormat: manifestCore.packageFormat,
    packageVersion: manifestCore.packageVersion,
    packageType: manifestCore.packageType,
    flowId: manifestCore.flowId,
    snapshotId: manifestCore.snapshotId || null,
    reviewVersion: manifestCore.reviewVersion,
    snapshotChainIndex: manifestCore.snapshotChainIndex ?? null,
    contentHash: manifestCore.contentHash || null,
    packageContentHash: manifestCore.packageContentHash
  });
}

export function signPayload(payload, ctx) {
  const input = JSON.stringify(buildSigningPayload(payload));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(input);
  signer.end();
  return signer.sign(ctx.privateKey, 'base64');
}

export function verifyPayloadSignature(payload, signature, ctx) {
  const input = JSON.stringify(buildSigningPayload(payload));
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(input);
  verifier.end();
  return verifier.verify(ctx.publicKey, signature, 'base64');
}

function keyLifecycleStatus(key, nowTs) {
  if (!key) return { status: 'missing_key', reasonCodes: ['missing_signer_key_in_keyset'] };
  if (key.keyStatus === 'revoked' || key.status === 'revoked') return { status: 'signer_key_revoked', reasonCodes: ['signer_key_revoked'] };
  if (key.activatedAt && nowTs < Date.parse(key.activatedAt)) return { status: 'signer_key_not_yet_active', reasonCodes: ['signer_key_not_yet_active'] };
  if (key.retiresAt && nowTs > Date.parse(key.retiresAt)) return { status: 'verified_with_retired_key', reasonCodes: ['signer_key_retired'] };
  return { status: 'active', reasonCodes: [] };
}

export async function verifyVerificationMetadata(meta, explicitCtx = null) {
  const ctx = explicitCtx || await getSigningContext();
  const keyset = explicitCtx?.keyset || await getVerificationKeyset();

  if (!meta || typeof meta !== 'object') return { status: 'malformed_verification_payload', reasonCodes: ['missing_metadata'] };
  if (!meta.packageContentHash) return { status: 'content_hash_mismatch', reasonCodes: ['missing_package_content_hash'] };
  if (meta.integrityPackageContentHash && meta.integrityPackageContentHash !== meta.packageContentHash) {
    return { status: 'content_hash_mismatch', reasonCodes: ['manifest_integrity_package_content_hash_mismatch'] };
  }

  if (!meta.trustProfileId || !TRUST_PROFILES[meta.trustProfileId]) {
    return { status: 'unknown_trust_profile', reasonCodes: ['unknown_trust_profile'] };
  }

  if (!meta.packageSignature) {
    return { status: meta.signatureStatus === 'unsigned' ? 'unsigned' : 'missing_signature', reasonCodes: [meta.signatureStatus === 'unsigned' ? 'unsigned_package' : 'missing_signature'] };
  }

  if (!ctx?.enabled) return { status: 'missing_key', reasonCodes: ['missing_verifier_key'] };
  if (meta.packageSignatureVersion !== PACKAGE_SIGNATURE_VERSION) return { status: 'invalid_signature', reasonCodes: ['incompatible_signature_version'] };

  if (meta.signingKeyId && ctx.signingKeyId && meta.signingKeyId !== ctx.signingKeyId) return { status: 'signer_key_mismatch', reasonCodes: ['signing_key_id_mismatch'] };
  if (meta.signerKeyFingerprint && ctx.signerKeyFingerprint && meta.signerKeyFingerprint !== ctx.signerKeyFingerprint) return { status: 'signer_key_mismatch', reasonCodes: ['signer_fingerprint_mismatch'] };

  const ok = verifyPayloadSignature(meta, meta.packageSignature, ctx);
  if (!ok) return { status: 'invalid_signature', reasonCodes: ['signature_verification_failed'] };

  const published = (keyset.keys || []).find((k) => k.signingKeyId === meta.signingKeyId && k.signerKeyFingerprint === meta.signerKeyFingerprint);
  if (!published) return { status: 'verified_with_unpublished_key', reasonCodes: ['signature_verified_key_not_in_published_keyset'], keysetVersion: keyset.keysetVersion };

  const life = keyLifecycleStatus(published, Date.now());
  if (life.status === 'signer_key_revoked') return life;
  if (life.status === 'signer_key_not_yet_active') return life;
  if (life.status === 'verified_with_retired_key') return { ...life, keysetVersion: keyset.keysetVersion };

  return { status: 'verified', reasonCodes: ['signature_verified'], keysetVersion: keyset.keysetVersion };
}
