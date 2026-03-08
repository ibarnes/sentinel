import fs from 'fs/promises';
import crypto from 'crypto';

const DEFAULT_PRIVATE = '/home/ec2-user/.openclaw/workspace/reveal/keys/package-signing-private.pem';
const DEFAULT_PUBLIC = '/home/ec2-user/.openclaw/workspace/reveal/keys/package-signing-public.pem';
export const PACKAGE_SIGNATURE_VERSION = 'sig-v1';

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

export async function getSigningContext() {
  const privateKey = process.env.REVEAL_SIGNING_PRIVATE_KEY || await readIfExists(DEFAULT_PRIVATE);
  const publicKey = process.env.REVEAL_SIGNING_PUBLIC_KEY || await readIfExists(DEFAULT_PUBLIC);
  if (!privateKey || !publicKey) return { enabled: false, unsignedReason: 'missing_key' };

  const signingAlgorithm = 'RSA-SHA256';
  const keyId = process.env.REVEAL_SIGNING_KEY_ID || crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
  return { enabled: true, privateKey, publicKey, signingAlgorithm, signingKeyId: keyId };
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
  const sig = signer.sign(ctx.privateKey, 'base64');
  return sig;
}

export function verifyPayloadSignature(payload, signature, ctx) {
  const input = JSON.stringify(buildSigningPayload(payload));
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(input);
  verifier.end();
  return verifier.verify(ctx.publicKey, signature, 'base64');
}

export function verifyVerificationMetadata(meta, ctx) {
  if (!meta) return { status: 'malformed_verification_payload', reasonCodes: ['missing_metadata'] };
  if (!meta.packageContentHash) return { status: 'content_hash_mismatch', reasonCodes: ['missing_package_content_hash'] };
  if (meta.integrityPackageContentHash && meta.integrityPackageContentHash !== meta.packageContentHash) {
    return { status: 'content_hash_mismatch', reasonCodes: ['manifest_integrity_package_content_hash_mismatch'] };
  }
  if (!meta.packageSignature) return { status: meta.signatureStatus === 'unsigned' ? 'unsigned' : 'missing_signature', reasonCodes: ['missing_signature'] };
  if (!ctx?.enabled) return { status: 'missing_key', reasonCodes: ['missing_verifier_key'] };
  if (meta.packageSignatureVersion !== PACKAGE_SIGNATURE_VERSION) return { status: 'invalid_signature', reasonCodes: ['incompatible_signature_version'] };
  if (meta.signingKeyId && ctx.signingKeyId && meta.signingKeyId !== ctx.signingKeyId) return { status: 'invalid_signature', reasonCodes: ['signing_key_id_mismatch'] };

  const ok = verifyPayloadSignature(meta, meta.packageSignature, ctx);
  return ok ? { status: 'verified', reasonCodes: ['signature_verified'] } : { status: 'invalid_signature', reasonCodes: ['signature_verification_failed'] };
}
