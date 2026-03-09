import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';
import { getExecutionResultArtifact, listExecutionResultArtifacts } from './executionResultArtifactService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/result-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const SIG_VERSION = 'result-trust-sig-v1';

const canonicalize = (v) => {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalize);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (['transportId','requestId','headers','receivedAt','runtimeMs'].includes(k)) continue;
      const cv = canonicalize(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
};

const id = () => `rtpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const dirFor = (executionResultArtifactId) => path.join(ROOT, executionResultArtifactId);
const fileFor = (executionResultArtifactId, resultTrustPublicationId) => path.join(dirFor(executionResultArtifactId), `${resultTrustPublicationId}.json`);

const headPayload = (r) => canonicalize({
  latestExecutionResultArtifactId: r.latestExecutionResultArtifactId,
  latestResultArtifactDigest: r.latestResultArtifactDigest,
  latestResultArtifactType: r.latestResultArtifactType,
  sourceExecutionReceiptId: r.sourceExecutionReceiptId,
  sourceProviderSubmissionContractId: r.sourceProviderSubmissionContractId,
  providerType: r.providerType,
  providerProfileId: r.providerProfileId,
  previousPublishedResultHeadDigest: r.previousPublishedResultHeadDigest || null,
  publicationVersion: r.publicationVersion
});

const signingPayload = (r) => canonicalize({
  resultTrustPublicationId: r.resultTrustPublicationId,
  publishedAt: r.createdAt,
  publicationVersion: r.publicationVersion,
  providerType: r.providerType,
  providerProfileId: r.providerProfileId,
  sourceExecutionReceiptId: r.sourceExecutionReceiptId,
  sourceProviderSubmissionContractId: r.sourceProviderSubmissionContractId,
  latestExecutionResultArtifactId: r.latestExecutionResultArtifactId,
  latestResultArtifactDigest: r.latestResultArtifactDigest,
  latestResultArtifactType: r.latestResultArtifactType,
  previousPublishedResultHeadDigest: r.previousPublishedResultHeadDigest || null,
  resultHeadDigest: r.resultHeadDigest,
  resultHeadDigestVersion: r.resultHeadDigestVersion
});

async function listRaw(executionResultArtifactId) {
  const dir = dirFor(executionResultArtifactId);
  const exists = await fs.access(dir).then(() => true).catch(() => false);
  if (!exists) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try { rows.push(JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))); } catch {}
  }
  rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return rows;
}

async function resolveLatestLineageArtifact(artifact) {
  const list = await listExecutionResultArtifacts({
    providerType: artifact.providerType,
    providerProfileId: artifact.providerProfileId,
    sourceExecutionReceiptId: artifact.sourceExecutionReceiptId || null
  });
  const candidates = (list.executionResultArtifacts || []).filter((r) => r.sourceProviderSubmissionContractId === artifact.sourceProviderSubmissionContractId);
  candidates.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return candidates[0] || artifact;
}

export async function publishResultTrust(executionResultArtifactId) {
  const got = await getExecutionResultArtifact(executionResultArtifactId);
  if (got.error) return got;
  const resolvedLatest = await resolveLatestLineageArtifact(got.executionResultArtifact);

  const prev = await getLatestResultTrustPublication(executionResultArtifactId);
  const row = {
    resultTrustPublicationId: id(),
    createdAt: new Date().toISOString(),
    publicationVersion: 'v1',
    providerType: resolvedLatest.providerType,
    providerProfileId: resolvedLatest.providerProfileId,
    sourceExecutionReceiptId: resolvedLatest.sourceExecutionReceiptId || null,
    sourceProviderSubmissionContractId: resolvedLatest.sourceProviderSubmissionContractId || null,
    latestExecutionResultArtifactId: resolvedLatest.executionResultArtifactId,
    latestResultArtifactDigest: resolvedLatest.artifactDigest,
    latestResultArtifactType: resolvedLatest.artifactType,
    previousPublishedResultHeadDigest: prev.error ? null : prev.resultTrustPublication.resultHeadDigest,
    resultHeadDigest: null,
    resultHeadDigestVersion: DIGEST_VERSION,
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    resultTrustPublicationSignature: null,
    resultTrustPublicationSignatureVersion: SIG_VERSION,
    resultTrustPublicationSigningKeyId: null,
    resultTrustPublicationSigningAlgorithm: 'RSA-SHA256',
    resultTrustPublicationSignatureStatus: 'unsigned',
    resultTrustPublicationSignatureValid: null,
    publicationStatus: 'active',
    metadata: { deterministic: true }
  };

  row.resultHeadDigest = crypto.createHash('sha256').update(JSON.stringify(headPayload(row))).digest('hex');

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(signingPayload(row)));
    signer.end();
    const sig = signer.sign(ctx.privateKey, 'base64');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(JSON.stringify(signingPayload(row)));
    verifier.end();
    row.resultTrustPublicationSignature = sig;
    row.resultTrustPublicationSigningKeyId = ctx.signingKeyId;
    row.resultTrustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    row.resultTrustPublicationSignatureStatus = 'signed';
    row.resultTrustPublicationSignatureValid = verifier.verify(ctx.publicKey, sig, 'base64');
  } else {
    row.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  await fs.mkdir(dirFor(executionResultArtifactId), { recursive: true });
  const fp = fileFor(executionResultArtifactId, row.resultTrustPublicationId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'result_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(row, null, 2), 'utf8');
  return { resultTrustPublication: row };
}

export async function listResultTrustPublications(executionResultArtifactId) {
  return { resultTrustPublications: await listRaw(executionResultArtifactId) };
}

export async function getResultTrustPublication(executionResultArtifactId, resultTrustPublicationId) {
  try { return { resultTrustPublication: JSON.parse(await fs.readFile(fileFor(executionResultArtifactId, resultTrustPublicationId), 'utf8')) }; }
  catch { return { error: 'result_trust_publication_not_found' }; }
}

export async function getLatestResultTrustPublication(executionResultArtifactId) {
  const rows = await listRaw(executionResultArtifactId);
  if (!rows.length) return { error: 'result_trust_publication_not_found' };
  return { resultTrustPublication: rows[rows.length - 1] };
}

export async function verifyResultTrustPublication(executionResultArtifactId, resultTrustPublicationId = null) {
  const pub = resultTrustPublicationId ? await getResultTrustPublication(executionResultArtifactId, resultTrustPublicationId) : await getLatestResultTrustPublication(executionResultArtifactId);
  if (pub.error) return pub;
  const row = pub.resultTrustPublication;
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(headPayload(row))).digest('hex');
  if (recomputed !== row.resultHeadDigest) return { status: 'result_head_digest_mismatch', reasonCodes: ['result_head_digest_mismatch'], storedResultHeadDigest: row.resultHeadDigest, recomputedResultHeadDigest: recomputed };
  return { status: 'verified', reasonCodes: ['result_head_digest_verified'], signatureStatus: row.resultTrustPublicationSignatureStatus, resultHeadDigest: row.resultHeadDigest };
}
