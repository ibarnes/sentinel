import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';
import { payloadHash } from './detachedVerifierPackService.js';
import { getOrchestrationProofTrustPublication } from './orchestrationProofTrustPublicationService.js';

const canonicalize = (v) => {
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
};

export async function verifyDetachedProof({ payload = null, signature = null, trust = null } = {}) {
  if (!payload || typeof payload !== 'object') {
    return { status: 'malformed_detached_pack', reasonCodes: ['malformed_detached_payload'] };
  }
  if (!signature || typeof signature !== 'object') {
    return { status: 'malformed_detached_pack', reasonCodes: ['malformed_detached_signature'] };
  }

  const hash = payloadHash(payload);
  if (!signature.payloadHash) {
    return { status: 'payload_hash_mismatch', reasonCodes: ['detached_payload_hash_missing'] };
  }
  if (signature.payloadHash !== hash) {
    return { status: 'payload_hash_mismatch', reasonCodes: ['payload_hash_mismatch'], storedPayloadHash: signature.payloadHash, recomputedPayloadHash: hash };
  }

  const ctx = await getSigningContext();
  if (!signature.detachedSignature) {
    return {
      status: 'unsigned',
      startDecision: payload.startDecision || 'no_start',
      overallVerdict: payload.overallVerdict || 'deny',
      blockingReasons: ['detached_signature_missing'],
      warnings: [],
      proofDigest: payload.proofDigest || null,
      linkedPublicationDigest: trust?.proofHeadDigest || null,
      verifiedAt: new Date().toISOString()
    };
  }
  if (!ctx.enabled) {
    return { status: 'unsigned', reasonCodes: ['missing_verifier_key'] };
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(JSON.stringify(canonicalize(payload)));
  verifier.end();
  const signatureOk = verifier.verify(ctx.publicKey, signature.detachedSignature, 'base64');
  if (!signatureOk) {
    return {
      status: 'invalid_signature',
      startDecision: payload.startDecision || 'no_start',
      overallVerdict: payload.overallVerdict || 'deny',
      blockingReasons: ['detached_signature_invalid'],
      warnings: [],
      proofDigest: payload.proofDigest || null,
      linkedPublicationDigest: trust?.proofHeadDigest || null,
      verifiedAt: new Date().toISOString()
    };
  }

  if (trust?.orchestrationProofCertificateId && trust?.orchestrationProofTrustPublicationId) {
    const pub = await getOrchestrationProofTrustPublication(trust.orchestrationProofCertificateId, trust.orchestrationProofTrustPublicationId);
    if (pub.error) {
      return { status: 'trust_publication_invalid', reasonCodes: ['missing_required_link'] };
    }
    if (pub.orchestrationProofTrustPublication.latestProofDigest !== payload.proofDigest) {
      return { status: 'trust_publication_invalid', reasonCodes: ['proof_head_link_mismatch'] };
    }
  }

  return {
    status: 'verified',
    startDecision: payload.startDecision || 'no_start',
    overallVerdict: payload.overallVerdict || 'deny',
    blockingReasons: payload.blockingReasons || [],
    warnings: payload.warnings || [],
    proofDigest: payload.proofDigest || null,
    linkedPublicationDigest: trust?.proofHeadDigest || null,
    verifiedAt: new Date().toISOString(),
    reasonCodes: ['payload_hash_verified', 'detached_signature_verified']
  };
}
