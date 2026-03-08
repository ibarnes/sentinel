import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { listReviewedSnapshots, verifyReviewedSnapshotIntegrity } from './reviewedScriptSnapshotService.js';
import { getSigningContext, signPayload, PACKAGE_SIGNATURE_VERSION } from '../services/packageSigningService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-script-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const PUBLICATION_VERSION = 'v1';

function dirFor(scriptId) { return path.join(ROOT, scriptId); }
function fileFor(scriptId, id) { return path.join(dirFor(scriptId), `${id}.json`); }
function publicationId() { return `rtp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function canonicalize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => canonicalize(v));
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      const v = canonicalize(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return value;
}

function buildChainHeadPayload(pub) {
  return canonicalize({
    scriptId: pub.scriptId,
    publicationVersion: pub.publicationVersion,
    latestReviewedSnapshotId: pub.latestReviewedSnapshotId,
    latestReviewedSnapshotContentHash: pub.latestReviewedSnapshotContentHash,
    latestReviewedSnapshotChainIndex: pub.latestReviewedSnapshotChainIndex,
    chainContinuitySummary: pub.chainContinuitySummary,
    previousPublishedHeadDigest: pub.previousPublishedHeadDigest || null
  });
}

function computeHeadDigest(pub) {
  return crypto.createHash('sha256').update(JSON.stringify(buildChainHeadPayload(pub))).digest('hex');
}

function buildSigningPayload(pub) {
  return canonicalize({
    trustPublicationId: pub.trustPublicationId,
    scriptId: pub.scriptId,
    publicationVersion: pub.publicationVersion,
    publishedAt: pub.publishedAt,
    chainHeadDigest: pub.chainHeadDigest,
    chainHeadDigestVersion: pub.chainHeadDigestVersion,
    latestReviewedSnapshotId: pub.latestReviewedSnapshotId,
    latestReviewedSnapshotContentHash: pub.latestReviewedSnapshotContentHash,
    latestReviewedSnapshotChainIndex: pub.latestReviewedSnapshotChainIndex,
    previousPublishedHeadDigest: pub.previousPublishedHeadDigest || null
  });
}

async function listRaw(scriptId) {
  const d = dirFor(scriptId);
  const exists = await fs.access(d).then(() => true).catch(() => false);
  if (!exists) return [];
  const files = (await fs.readdir(d)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try { rows.push(JSON.parse(await fs.readFile(path.join(d, f), 'utf8'))); } catch {}
  }
  rows.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
  return rows;
}

export async function listTrustPublications(scriptId) {
  const rows = await listRaw(scriptId);
  return {
    trustPublications: rows.map((r) => ({
      trustPublicationId: r.trustPublicationId,
      scriptId: r.scriptId,
      latestReviewedSnapshotId: r.latestReviewedSnapshotId,
      latestReviewedSnapshotContentHash: r.latestReviewedSnapshotContentHash,
      latestReviewedSnapshotChainIndex: r.latestReviewedSnapshotChainIndex,
      chainHeadDigest: r.chainHeadDigest,
      chainHeadDigestVersion: r.chainHeadDigestVersion,
      publicationVersion: r.publicationVersion,
      publishedAt: r.publishedAt,
      trustPublicationSignatureStatus: r.trustPublicationSignatureStatus,
      publicationStatus: r.publicationStatus
    }))
  };
}

export async function getTrustPublication(scriptId, trustPublicationId) {
  try {
    const trustPublication = JSON.parse(await fs.readFile(fileFor(scriptId, trustPublicationId), 'utf8'));
    return { trustPublication };
  } catch {
    return { error: 'trust_publication_not_found' };
  }
}

export async function getLatestTrustPublication(scriptId) {
  const rows = await listRaw(scriptId);
  if (!rows.length) return { error: 'trust_publication_not_found' };
  return { trustPublication: rows[rows.length - 1] };
}

export async function publishTrust(scriptId) {
  const snaps = await listReviewedSnapshots(scriptId);
  if (!(snaps.snapshots || []).length) return { error: 'no_reviewed_snapshot_for_publication' };
  const latest = [...snaps.snapshots].sort((a, b) => Number(b.reviewedSnapshotChainIndex || 0) - Number(a.reviewedSnapshotChainIndex || 0))[0];
  const integrity = await verifyReviewedSnapshotIntegrity(scriptId, latest.reviewedSnapshotId);

  const prev = await getLatestTrustPublication(scriptId);
  const now = new Date().toISOString();
  const pub = {
    scriptId,
    trustPublicationId: publicationId(),
    latestReviewedSnapshotId: latest.reviewedSnapshotId,
    latestReviewedSnapshotContentHash: latest.reviewedSnapshotContentHash,
    latestReviewedSnapshotChainIndex: latest.reviewedSnapshotChainIndex,
    chainContinuitySummary: {
      latestIntegrityStatus: integrity.integrityStatus,
      parentReviewedSnapshotId: latest.parentReviewedSnapshotId || null,
      isChainRoot: Boolean(latest.isChainRoot)
    },
    previousPublishedHeadDigest: prev.error ? null : (prev.trustPublication.chainHeadDigest || null),
    publicationVersion: PUBLICATION_VERSION,
    publishedAt: now,
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    publicationStatus: 'active'
  };

  pub.chainHeadDigestVersion = DIGEST_VERSION;
  pub.chainHeadDigest = computeHeadDigest(pub);

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const sigPayload = buildSigningPayload(pub);
    pub.trustPublicationSignature = signPayload(sigPayload, ctx);
    pub.trustPublicationSignatureVersion = PACKAGE_SIGNATURE_VERSION;
    pub.trustPublicationSigningKeyId = ctx.signingKeyId;
    pub.trustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    pub.trustPublicationSignatureStatus = 'signed';
    pub.signerMetadata = { signerKeyFingerprint: ctx.signerKeyFingerprint, publicKeyHint: ctx.publicKeyHint };
  } else {
    pub.trustPublicationSignature = null;
    pub.trustPublicationSignatureVersion = PACKAGE_SIGNATURE_VERSION;
    pub.trustPublicationSigningKeyId = null;
    pub.trustPublicationSigningAlgorithm = 'RSA-SHA256';
    pub.trustPublicationSignatureStatus = 'unsigned';
    pub.unsignedReason = ctx.unsignedReason || 'missing_key';
    pub.signerMetadata = null;
  }

  await fs.mkdir(dirFor(scriptId), { recursive: true });
  const fp = fileFor(scriptId, pub.trustPublicationId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(pub, null, 2), 'utf8');

  return { trustPublication: pub };
}

export { buildSigningPayload as buildTrustPublicationSigningPayload };
