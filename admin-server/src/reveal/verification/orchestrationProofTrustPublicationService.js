import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';
import { getOrchestrationProofCertificate } from './orchestrationProofCertificateService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/orchestration-proof-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const SIG_VERSION = 'orchestration-proof-trust-sig-v1';

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

function trustDir(orchestrationProofCertificateId) { return path.join(ROOT, orchestrationProofCertificateId); }
function trustFile(orchestrationProofCertificateId, orchestrationProofTrustPublicationId) { return path.join(trustDir(orchestrationProofCertificateId), `${orchestrationProofTrustPublicationId}.json`); }
function id() { return `optpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function headDigest(p) {
  const digestPayload = canonicalize({
    orchestrationProfile: p.orchestrationProfile,
    renderAdapterContractId: p.renderAdapterContractId,
    latestOrchestrationProofCertificateId: p.latestOrchestrationProofCertificateId,
    latestProofDigest: p.latestProofDigest,
    latestProofDigestVersion: p.latestProofDigestVersion,
    previousPublishedProofHeadDigest: p.previousPublishedProofHeadDigest || null,
    publicationVersion: p.publicationVersion,
    proofTrustPublicationSignatureStatus: p.proofTrustPublicationSignatureStatus
  });
  return crypto.createHash('sha256').update(JSON.stringify(digestPayload)).digest('hex');
}

function signingPayload(p) {
  return canonicalize({
    orchestrationProofTrustPublicationId: p.orchestrationProofTrustPublicationId,
    createdAt: p.createdAt,
    publicationVersion: p.publicationVersion,
    renderAdapterContractId: p.renderAdapterContractId,
    orchestrationProfile: p.orchestrationProfile,
    latestOrchestrationProofCertificateId: p.latestOrchestrationProofCertificateId,
    latestProofDigest: p.latestProofDigest,
    latestProofDigestVersion: p.latestProofDigestVersion,
    previousPublishedProofHeadDigest: p.previousPublishedProofHeadDigest || null,
    proofHeadDigest: p.proofHeadDigest,
    proofHeadDigestVersion: p.proofHeadDigestVersion,
    publicationStatus: p.publicationStatus
  });
}

async function listRaw(orchestrationProofCertificateId) {
  const dir = trustDir(orchestrationProofCertificateId);
  const exists = await fs.access(dir).then(() => true).catch(() => false);
  if (!exists) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const file of files) {
    try { rows.push(JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'))); } catch {}
  }
  rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return rows;
}

export async function publishOrchestrationProofTrust(orchestrationProofCertificateId) {
  const got = await getOrchestrationProofCertificate(orchestrationProofCertificateId);
  if (got.error) return { error: 'orchestration_proof_certificate_not_found' };
  const cert = got.orchestrationProofCertificate;
  const prev = await getLatestOrchestrationProofTrustPublication(orchestrationProofCertificateId);

  const publication = {
    orchestrationProofTrustPublicationId: id(),
    createdAt: new Date().toISOString(),
    publicationVersion: 'v1',
    renderAdapterContractId: cert.renderAdapterContractId || null,
    orchestrationProfile: cert.orchestrationProfile || null,
    latestOrchestrationProofCertificateId: cert.orchestrationProofCertificateId,
    latestProofDigest: cert.proofDigest || null,
    latestProofDigestVersion: cert.proofDigestVersion || DIGEST_VERSION,
    previousPublishedProofHeadDigest: prev.error ? null : prev.orchestrationProofTrustPublication.proofHeadDigest,
    proofHeadDigest: null,
    proofHeadDigestVersion: DIGEST_VERSION,
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    publicationStatus: 'active',
    metadata: {
      certificateSignatureStatus: cert.certificateSignatureStatus || 'unsigned',
      startDecision: cert.startDecision || null,
      overallVerdict: cert.overallVerdict || null
    }
  };

  publication.proofHeadDigest = headDigest({ ...publication, proofTrustPublicationSignatureStatus: 'pending' });

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(signingPayload(publication)));
    signer.end();
    const signature = signer.sign(ctx.privateKey, 'base64');

    publication.proofTrustPublicationSignature = signature;
    publication.proofTrustPublicationSignatureVersion = SIG_VERSION;
    publication.proofTrustPublicationSigningKeyId = ctx.signingKeyId;
    publication.proofTrustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    publication.proofTrustPublicationSignatureStatus = 'signed';

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(JSON.stringify(signingPayload(publication)));
    verifier.end();
    publication.proofTrustPublicationSignatureValid = verifier.verify(ctx.publicKey, signature, 'base64');
  } else {
    publication.proofTrustPublicationSignature = null;
    publication.proofTrustPublicationSignatureVersion = SIG_VERSION;
    publication.proofTrustPublicationSigningKeyId = null;
    publication.proofTrustPublicationSigningAlgorithm = 'RSA-SHA256';
    publication.proofTrustPublicationSignatureStatus = 'unsigned';
    publication.proofTrustPublicationSignatureValid = null;
    publication.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  publication.proofHeadDigest = headDigest(publication);

  await fs.mkdir(trustDir(orchestrationProofCertificateId), { recursive: true });
  const fp = trustFile(orchestrationProofCertificateId, publication.orchestrationProofTrustPublicationId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'orchestration_proof_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(publication, null, 2), 'utf8');

  return { orchestrationProofTrustPublication: publication };
}

export async function listOrchestrationProofTrustPublications(orchestrationProofCertificateId) {
  const rows = await listRaw(orchestrationProofCertificateId);
  return {
    orchestrationProofTrustPublications: rows.map((row) => ({
      orchestrationProofTrustPublicationId: row.orchestrationProofTrustPublicationId,
      createdAt: row.createdAt,
      renderAdapterContractId: row.renderAdapterContractId,
      orchestrationProfile: row.orchestrationProfile,
      latestOrchestrationProofCertificateId: row.latestOrchestrationProofCertificateId,
      latestProofDigest: row.latestProofDigest,
      latestProofDigestVersion: row.latestProofDigestVersion,
      previousPublishedProofHeadDigest: row.previousPublishedProofHeadDigest || null,
      proofHeadDigest: row.proofHeadDigest,
      proofHeadDigestVersion: row.proofHeadDigestVersion,
      proofTrustPublicationSignatureStatus: row.proofTrustPublicationSignatureStatus,
      publicationStatus: row.publicationStatus
    }))
  };
}

export async function getOrchestrationProofTrustPublication(orchestrationProofCertificateId, orchestrationProofTrustPublicationId) {
  try {
    return { orchestrationProofTrustPublication: JSON.parse(await fs.readFile(trustFile(orchestrationProofCertificateId, orchestrationProofTrustPublicationId), 'utf8')) };
  } catch {
    return { error: 'orchestration_proof_trust_publication_not_found' };
  }
}

export async function getLatestOrchestrationProofTrustPublication(orchestrationProofCertificateId) {
  const rows = await listRaw(orchestrationProofCertificateId);
  if (!rows.length) return { error: 'orchestration_proof_trust_publication_not_found' };
  return { orchestrationProofTrustPublication: rows[rows.length - 1] };
}
