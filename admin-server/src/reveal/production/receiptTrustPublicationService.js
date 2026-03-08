import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';
import { getExecutionReceipt, receiptDigest } from './executionReceiptService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/receipt-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const SIG_VERSION = 'receipt-trust-sig-v1';

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

const dirFor = (executionReceiptId) => path.join(ROOT, executionReceiptId);
const fileFor = (executionReceiptId, receiptTrustPublicationId) => path.join(dirFor(executionReceiptId), `${receiptTrustPublicationId}.json`);
const id = () => `rtpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

const headPayload = (row) => canonicalize({
  executionReceiptId: row.executionReceiptId,
  latestReceiptDigest: row.latestReceiptDigest,
  latestReceiptSignatureStatus: row.latestReceiptSignatureStatus,
  latestLifecycleEventIndex: row.latestLifecycleEventIndex,
  previousPublishedReceiptHeadDigest: row.previousPublishedReceiptHeadDigest || null,
  publicationVersion: row.publicationVersion
});

const signingPayload = (row) => canonicalize({
  receiptTrustPublicationId: row.receiptTrustPublicationId,
  executionReceiptId: row.executionReceiptId,
  latestReceiptDigest: row.latestReceiptDigest,
  latestReceiptSignatureStatus: row.latestReceiptSignatureStatus,
  latestLifecycleEventIndex: row.latestLifecycleEventIndex,
  receiptHeadDigest: row.receiptHeadDigest,
  receiptHeadDigestVersion: row.receiptHeadDigestVersion,
  publicationVersion: row.publicationVersion,
  publishedAt: row.publishedAt
});

async function listRaw(executionReceiptId) {
  const dir = dirFor(executionReceiptId);
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

export async function publishReceiptTrust(executionReceiptId) {
  const rec = await getExecutionReceipt(executionReceiptId);
  if (rec.error) return rec;
  const prev = await getLatestReceiptTrustPublication(executionReceiptId);

  const row = {
    receiptTrustPublicationId: id(),
    executionReceiptId,
    latestReceiptDigest: receiptDigest(rec.executionReceipt),
    latestReceiptSignatureStatus: rec.executionReceipt.receiptSignatureStatus || 'unsigned',
    latestLifecycleEventIndex: (rec.executionReceipt.lifecycleEvents || []).length,
    previousPublishedReceiptHeadDigest: prev.error ? null : prev.receiptTrustPublication.receiptHeadDigest,
    receiptHeadDigest: null,
    receiptHeadDigestVersion: DIGEST_VERSION,
    publicationVersion: 'v1',
    publishedAt: new Date().toISOString(),
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    publicationStatus: 'active',
    metadata: {}
  };

  row.receiptHeadDigest = crypto.createHash('sha256').update(JSON.stringify(headPayload(row))).digest('hex');

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(signingPayload(row)));
    signer.end();
    row.receiptTrustPublicationSignature = signer.sign(ctx.privateKey, 'base64');
    row.receiptTrustPublicationSignatureVersion = SIG_VERSION;
    row.receiptTrustPublicationSigningKeyId = ctx.signingKeyId;
    row.receiptTrustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    row.receiptTrustPublicationSignatureStatus = 'signed';
    row.receiptTrustPublicationSignatureValid = true;
  } else {
    row.receiptTrustPublicationSignature = null;
    row.receiptTrustPublicationSignatureVersion = SIG_VERSION;
    row.receiptTrustPublicationSigningKeyId = null;
    row.receiptTrustPublicationSigningAlgorithm = 'RSA-SHA256';
    row.receiptTrustPublicationSignatureStatus = 'unsigned';
    row.receiptTrustPublicationSignatureValid = null;
    row.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  await fs.mkdir(dirFor(executionReceiptId), { recursive: true });
  const fp = fileFor(executionReceiptId, row.receiptTrustPublicationId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'receipt_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(row, null, 2), 'utf8');
  return { receiptTrustPublication: row };
}

export async function listReceiptTrustPublications(executionReceiptId) {
  return { receiptTrustPublications: await listRaw(executionReceiptId) };
}

export async function getReceiptTrustPublication(executionReceiptId, receiptTrustPublicationId) {
  try { return { receiptTrustPublication: JSON.parse(await fs.readFile(fileFor(executionReceiptId, receiptTrustPublicationId), 'utf8')) }; }
  catch { return { error: 'receipt_trust_publication_not_found' }; }
}

export async function getLatestReceiptTrustPublication(executionReceiptId) {
  const rows = await listRaw(executionReceiptId);
  if (!rows.length) return { error: 'receipt_trust_publication_not_found' };
  return { receiptTrustPublication: rows[rows.length - 1] };
}
