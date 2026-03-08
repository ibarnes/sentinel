import crypto from 'crypto';

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

export function buildProofDigestInput(data) {
  return canonicalize({
    renderAdapterContractId: data.renderAdapterContractId,
    adapterTrustHeadDigest: data.adapterTrustHeadDigest || null,
    attestationTrustHeadDigest: data.attestationTrustHeadDigest || null,
    policyManifest: {
      policyProfileId: data.policyProfileId,
      version: data.policyVersion,
      signatureStatus: data.policySignatureStatus
    },
    admissionCertificate: {
      admissionCertificateId: data.admissionCertificateId,
      readinessDigest: data.admissionReadinessDigest,
      signatureStatus: data.admissionSignatureStatus
    },
    orchestrationProfile: data.orchestrationProfile,
    overallVerdict: data.overallVerdict,
    startDecision: data.startDecision,
    blockingReasons: data.blockingReasons || [],
    warnings: data.warnings || []
  });
}

export function computeProofDigest(data) {
  const payload = buildProofDigestInput(data);
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
