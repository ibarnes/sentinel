import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';

const HASH_VERSION = 'sha256-v1';
const PACK_VERSION = 'v1';
const DETACHED_SIG_VERSION = 'detached-proof-sig-v1';

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

export function buildDetachedPayloadFromProof(proof) {
  return canonicalize({
    payloadType: 'orchestration_proof',
    proofRef: {
      orchestrationProofCertificateId: proof.orchestrationProofCertificateId,
      renderAdapterContractId: proof.renderAdapterContractId,
      externalVerifierProfileId: proof.externalVerifierProfileId,
      admissionCertificateId: proof.admissionCertificateId
    },
    orchestrationProfile: proof.orchestrationProfile,
    startDecision: proof.startDecision,
    overallVerdict: proof.overallVerdict,
    blockingReasons: proof.blockingReasons || [],
    warnings: proof.warnings || [],
    proofDigest: proof.proofDigest,
    proofDigestVersion: proof.proofDigestVersion,
    linkedRefs: {
      adapterTrustPublicationRef: proof.adapterTrustPublicationRef || null,
      attestationTrustPublicationRef: proof.attestationTrustPublicationRef || null,
      policyManifestRef: proof.policyManifestRef || null
    },
    createdAt: proof.createdAt
  });
}

export function payloadHash(payload) {
  const canonicalPayload = canonicalize(payload);
  return crypto.createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
}

export async function buildDetachedVerifierPack(proof) {
  const payload = buildDetachedPayloadFromProof(proof);
  const hash = payloadHash(payload);
  const now = new Date().toISOString();

  const pack = {
    verifierPackId: `dvp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    createdAt: now,
    packVersion: PACK_VERSION,
    payloadType: 'orchestration_proof',
    payloadHash: hash,
    payloadHashVersion: HASH_VERSION,
    detachedSignature: null,
    detachedSignatureVersion: DETACHED_SIG_VERSION,
    signingKeyId: null,
    signingAlgorithm: 'RSA-SHA256',
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    linkedProofRefs: {
      orchestrationProofCertificateId: proof.orchestrationProofCertificateId,
      adapterTrustPublicationId: proof.adapterTrustPublicationRef?.adapterTrustPublicationId || null,
      attestationTrustPublicationId: proof.attestationTrustPublicationRef?.attestationTrustPublicationId || null,
      renderAdapterContractId: proof.renderAdapterContractId || null
    },
    minimalVerificationContext: {
      startDecision: proof.startDecision,
      overallVerdict: proof.overallVerdict,
      proofDigest: proof.proofDigest,
      proofDigestVersion: proof.proofDigestVersion
    },
    metadata: {}
  };

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(canonicalize(payload)));
    signer.end();
    const signature = signer.sign(ctx.privateKey, 'base64');
    pack.detachedSignature = signature;
    pack.signingKeyId = ctx.signingKeyId;
    pack.signingAlgorithm = ctx.signingAlgorithm;
    pack.detachedSignatureStatus = 'signed';

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(JSON.stringify(canonicalize(payload)));
    verifier.end();
    pack.detachedSignatureValid = verifier.verify(ctx.publicKey, signature, 'base64');
  } else {
    pack.detachedSignatureStatus = 'unsigned';
    pack.detachedSignatureValid = null;
    pack.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  return { pack, payload, signature: {
    detachedSignature: pack.detachedSignature,
    detachedSignatureVersion: pack.detachedSignatureVersion,
    signingKeyId: pack.signingKeyId,
    signingAlgorithm: pack.signingAlgorithm,
    detachedSignatureStatus: pack.detachedSignatureStatus,
    detachedSignatureValid: pack.detachedSignatureValid,
    payloadHash: pack.payloadHash,
    payloadHashVersion: pack.payloadHashVersion
  } };
}
