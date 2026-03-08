import crypto from 'crypto';

export function canonicalizeSubmission(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalizeSubmission);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const cv = canonicalizeSubmission(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

export function submissionPayloadDigest(payload) {
  const canonical = canonicalizeSubmission(payload);
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function manifestDigest(providerManifest) {
  return submissionPayloadDigest(providerManifest);
}
