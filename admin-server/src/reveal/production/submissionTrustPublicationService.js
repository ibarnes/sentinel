import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';
import { getProviderSubmissionContract } from './providerSubmissionService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/submission-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const SIG_VERSION = 'submission-trust-sig-v1';

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

const dirFor = (providerSubmissionContractId) => path.join(ROOT, providerSubmissionContractId);
const fileFor = (providerSubmissionContractId, submissionTrustPublicationId) => path.join(dirFor(providerSubmissionContractId), `${submissionTrustPublicationId}.json`);
const id = () => `stpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

const headPayload = (row) => canonicalize({
  providerSubmissionContractId: row.providerSubmissionContractId,
  latestSubmissionDigest: row.latestSubmissionDigest,
  latestSubmissionSignatureStatus: row.latestSubmissionSignatureStatus,
  previousPublishedSubmissionHeadDigest: row.previousPublishedSubmissionHeadDigest || null,
  publicationVersion: row.publicationVersion
});

const signingPayload = (row) => canonicalize({
  submissionTrustPublicationId: row.submissionTrustPublicationId,
  providerSubmissionContractId: row.providerSubmissionContractId,
  latestSubmissionDigest: row.latestSubmissionDigest,
  latestSubmissionSignatureStatus: row.latestSubmissionSignatureStatus,
  submissionHeadDigest: row.submissionHeadDigest,
  submissionHeadDigestVersion: row.submissionHeadDigestVersion,
  publicationVersion: row.publicationVersion,
  publishedAt: row.publishedAt
});

async function listRaw(providerSubmissionContractId) {
  const dir = dirFor(providerSubmissionContractId);
  const exists = await fs.access(dir).then(() => true).catch(() => false);
  if (!exists) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try { rows.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))); } catch {}
  }
  rows.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
  return rows;
}

export async function publishSubmissionTrust(providerSubmissionContractId) {
  const sub = await getProviderSubmissionContract(providerSubmissionContractId);
  if (sub.error) return sub;
  const prev = await getLatestSubmissionTrustPublication(providerSubmissionContractId);

  const row = {
    submissionTrustPublicationId: id(),
    providerSubmissionContractId,
    latestSubmissionDigest: sub.providerSubmissionContract.payloadDigest,
    latestSubmissionSignatureStatus: sub.providerSubmissionContract.submissionSignatureStatus || 'unsigned',
    previousPublishedSubmissionHeadDigest: prev.error ? null : prev.submissionTrustPublication.submissionHeadDigest,
    submissionHeadDigest: null,
    submissionHeadDigestVersion: DIGEST_VERSION,
    publicationVersion: 'v1',
    publishedAt: new Date().toISOString(),
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    publicationStatus: 'active',
    metadata: {}
  };

  row.submissionHeadDigest = crypto.createHash('sha256').update(JSON.stringify(headPayload(row))).digest('hex');

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(signingPayload(row)));
    signer.end();
    row.submissionTrustPublicationSignature = signer.sign(ctx.privateKey, 'base64');
    row.submissionTrustPublicationSignatureVersion = SIG_VERSION;
    row.submissionTrustPublicationSigningKeyId = ctx.signingKeyId;
    row.submissionTrustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    row.submissionTrustPublicationSignatureStatus = 'signed';
    row.submissionTrustPublicationSignatureValid = true;
  } else {
    row.submissionTrustPublicationSignature = null;
    row.submissionTrustPublicationSignatureVersion = SIG_VERSION;
    row.submissionTrustPublicationSigningKeyId = null;
    row.submissionTrustPublicationSigningAlgorithm = 'RSA-SHA256';
    row.submissionTrustPublicationSignatureStatus = 'unsigned';
    row.submissionTrustPublicationSignatureValid = null;
    row.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  await fs.mkdir(dirFor(providerSubmissionContractId), { recursive: true });
  const fp = fileFor(providerSubmissionContractId, row.submissionTrustPublicationId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'submission_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(row, null, 2), 'utf8');
  return { submissionTrustPublication: row };
}

export async function listSubmissionTrustPublications(providerSubmissionContractId) {
  return { submissionTrustPublications: await listRaw(providerSubmissionContractId) };
}

export async function getSubmissionTrustPublication(providerSubmissionContractId, submissionTrustPublicationId) {
  try { return { submissionTrustPublication: JSON.parse(await fs.readFile(fileFor(providerSubmissionContractId, submissionTrustPublicationId), 'utf8')) }; }
  catch { return { error: 'submission_trust_publication_not_found' }; }
}

export async function getLatestSubmissionTrustPublication(providerSubmissionContractId) {
  const rows = await listRaw(providerSubmissionContractId);
  if (!rows.length) return { error: 'submission_trust_publication_not_found' };
  return { submissionTrustPublication: rows[rows.length - 1] };
}
