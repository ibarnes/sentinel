import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';

const POLICY_VERSION = 'v1';
const SIG_VERSION = 'policy-manifest-sig-v1';

const DEFINITIONS = {
  dev: {
    policyProfileId: 'dev',
    policyProfileName: 'Development',
    requiredChecks: [],
    optionalChecks: ['script_integrity', 'voice_integrity', 'trust_publications', 'subtitle_proof'],
    blockingConditions: [],
    warningConditions: ['missing_trust_publication', 'unsigned_proof']
  },
  internal_verified: {
    policyProfileId: 'internal_verified',
    policyProfileName: 'Internal Verified',
    requiredChecks: ['script_integrity', 'voice_integrity', 'voice_trust_publication'],
    optionalChecks: ['subtitle_proof_signed'],
    blockingConditions: ['integrity_failed', 'trust_publication_missing'],
    warningConditions: ['unsigned_proof']
  },
  production_verified: {
    policyProfileId: 'production_verified',
    policyProfileName: 'Production Verified',
    requiredChecks: ['script_integrity', 'script_trust_signed', 'voice_integrity', 'voice_trust_signed', 'subtitle_proof_signed'],
    optionalChecks: [],
    blockingConditions: ['integrity_failed', 'trust_publication_missing', 'unsigned_trust_publication', 'unsigned_subtitle_proof'],
    warningConditions: []
  }
};

function canonicalize(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalize);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const cv = canonicalize(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

function payload(manifest) {
  return canonicalize({
    policyProfileId: manifest.policyProfileId,
    policyProfileName: manifest.policyProfileName,
    version: manifest.version,
    requiredChecks: manifest.requiredChecks,
    optionalChecks: manifest.optionalChecks,
    blockingConditions: manifest.blockingConditions,
    warningConditions: manifest.warningConditions,
    createdAt: manifest.createdAt
  });
}

export async function getPolicyManifest(policyProfileId) {
  const d = DEFINITIONS[policyProfileId];
  if (!d) return { error: 'unsupported_policy_profile' };
  const manifest = { ...d, version: POLICY_VERSION, createdAt: '2026-03-08T00:00:00.000Z' };

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(payload(manifest)));
    signer.end();
    manifest.policyManifestSignature = signer.sign(ctx.privateKey, 'base64');
    manifest.policyManifestSignatureVersion = SIG_VERSION;
    manifest.policyManifestSigningKeyId = ctx.signingKeyId;
    manifest.policyManifestSigningAlgorithm = ctx.signingAlgorithm;
    manifest.policyManifestSignatureStatus = 'signed';
  } else {
    manifest.policyManifestSignature = null;
    manifest.policyManifestSignatureVersion = SIG_VERSION;
    manifest.policyManifestSigningKeyId = null;
    manifest.policyManifestSigningAlgorithm = 'RSA-SHA256';
    manifest.policyManifestSignatureStatus = 'unsigned';
    manifest.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  return { policyManifest: manifest };
}

export async function listPolicyManifests() {
  const out = [];
  for (const id of Object.keys(DEFINITIONS)) out.push((await getPolicyManifest(id)).policyManifest);
  return { policies: out };
}
