import fs from 'fs/promises';
import crypto from 'crypto';

const DEFAULT_PRIVATE = '/home/ec2-user/.openclaw/workspace/reveal/keys/package-signing-private.pem';
const DEFAULT_PUBLIC = '/home/ec2-user/.openclaw/workspace/reveal/keys/package-signing-public.pem';
export const PACKAGE_SIGNATURE_VERSION = 'sig-v1';
export const VERIFICATION_POLICY_VERSION = 'policy-v1';

export const TRUST_PROFILES = {
  local_dev: {
    trustProfileId: 'local_dev',
    trustProfileName: 'Local Development',
    trustProfileVersion: 1,
    trustProfileType: 'local_dev',
    signerIdentity: 'Reveal Local Signer',
    verificationPolicyVersion: VERIFICATION_POLICY_VERSION
  },
  internal_verified: {
    trustProfileId: 'internal_verified',
    trustProfileName: 'Internal Verified',
    trustProfileVersion: 1,
    trustProfileType: 'internal_verified',
    signerIdentity: 'Reveal Internal Signer',
    verificationPolicyVersion: VERIFICATION_POLICY_VERSION
  },
  unsigned_export: {
    trustProfileId: 'unsigned_export',
    trustProfileName: 'Unsigned Export',
    trustProfileVersion: 1,
    trustProfileType: 'unsigned_export',
    signerIdentity: 'None',
    verificationPolicyVersion: VERIFICATION_POLICY_VERSION
  }
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

async function readIfExists(p) {
  try { return await fs.readFile(p, 'utf8'); } catch { return null; }
}

function fingerprintForPublicKey(publicKey) {
  if (!publicKey) return null;
  return crypto.createHash('sha256').update(publicKey).digest('hex');
}

function selectedProfile(enabled) {
  if (!enabled) return TRUST_PROFILES.unsigned_export;
  const wanted = String(process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev');
  return TRUST_PROFILES[wanted] || TRUST_PROFILES.local_dev;
}

export async function getSigningContext() {
  const privateKey = process.env.REVEAL_SIGNING_PRIVATE_KEY || await readIfExists(DEFAULT_PRIVATE);
  const publicKey = process.env.REVEAL_SIGNING_PUBLIC_KEY || await readIfExists(DEFAULT_PUBLIC);
  const enabled = Boolean(privateKey && publicKey);
  const profile = selectedProfile(enabled);

  if (!enabled) {
    return {
      enabled: false,
      unsignedReason: 'missing_key',
      trustProfile: profile,
      keysetVersion: 'keyset-v1'
    };
  }

  const signingAlgorithm = 'RSA-SHA256';
  const publicKeyAlgorithm = 'RSA';
  const signingKeyId = process.env.REVEAL_SIGNING_KEY_ID || fingerprintForPublicKey(publicKey).slice(0, 16);
  const signerKeyFingerprint = fingerprintForPublicKey(publicKey);

  return {
    enabled: true,
    privateKey,
    publicKey,
    signingAlgorithm,
    publicKeyAlgorithm,
    signingKeyId,
    signerKeyFingerprint,
    publicKeyHint: signerKeyFingerprint?.slice(0, 12) || null,
    trustProfile: profile,
    keysetVersion: 'keyset-v1'
  };
}

export async function getVerificationKeyset() {
  const ctx = await getSigningContext();
  const keys = [];
  if (ctx.enabled) {
    keys.push({
      signingKeyId: ctx.signingKeyId,
      signerKeyFingerprint: ctx.signerKeyFingerprint,
      algorithm: ctx.signingAlgorithm,
      publicKeyAlgorithm: ctx.publicKeyAlgorithm,
      publicKeyPem: ctx.publicKey,
      trustProfileId: ctx.trustProfile.trustProfileId,
      trustProfileName: ctx.trustProfile.trustProfileName,
      status: 'active',
      keyHint: ctx.publicKeyHint
    });
  }

  return {
    keysetVersion: ctx.keysetVersion || 'keyset-v1',
    publishedAt: new Date().toISOString(),
    trustProfiles: Object.values(TRUST_PROFILES),
    keys
  };
}

export function buildSigningPayload(manifestCore) {
  // deterministic payload: only trust-critical fields
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
    return {
      status: meta.signatureStatus === 'unsigned' ? 'unsigned' : 'missing_signature',
      reasonCodes: [meta.signatureStatus === 'unsigned' ? 'unsigned_package' : 'missing_signature']
    };
  }

  if (!ctx?.enabled) return { status: 'missing_key', reasonCodes: ['missing_verifier_key'] };
  if (meta.packageSignatureVersion !== PACKAGE_SIGNATURE_VERSION) return { status: 'invalid_signature', reasonCodes: ['incompatible_signature_version'] };

  if (meta.signingKeyId && ctx.signingKeyId && meta.signingKeyId !== ctx.signingKeyId) {
    return { status: 'signer_key_mismatch', reasonCodes: ['signing_key_id_mismatch'] };
  }
  if (meta.signerKeyFingerprint && ctx.signerKeyFingerprint && meta.signerKeyFingerprint !== ctx.signerKeyFingerprint) {
    return { status: 'signer_key_mismatch', reasonCodes: ['signer_fingerprint_mismatch'] };
  }

  const ok = verifyPayloadSignature(meta, meta.packageSignature, ctx);
  if (!ok) return { status: 'invalid_signature', reasonCodes: ['signature_verification_failed'] };

  const published = keyset.keys.find((k) => k.signingKeyId === meta.signingKeyId && k.signerKeyFingerprint === meta.signerKeyFingerprint);
  if (!published) return { status: 'verified_with_unpublished_key', reasonCodes: ['signature_verified_key_not_in_published_keyset'], keysetVersion: keyset.keysetVersion };

  return { status: 'verified', reasonCodes: ['signature_verified'], keysetVersion: keyset.keysetVersion };
}
