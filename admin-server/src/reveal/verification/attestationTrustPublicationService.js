import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { listAttestationSnapshots } from './attestationSnapshotService.js';
import { getSigningContext } from '../services/packageSigningService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/attestation-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const SIG_VERSION = 'attestation-trust-sig-v1';

function dirFor(verifierPackageId){ return path.join(ROOT, verifierPackageId); }
function fileFor(verifierPackageId, attestationTrustPublicationId){ return path.join(dirFor(verifierPackageId), `${attestationTrustPublicationId}.json`); }
function id(){ return `atpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function canonicalize(v){
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

function headDigest(pub){
  const p = canonicalize({
    verifierPackageId: pub.verifierPackageId,
    publicationVersion: pub.publicationVersion,
    latestAttestationSnapshotId: pub.latestAttestationSnapshotId,
    latestAttestationSnapshotContentHash: pub.latestAttestationSnapshotContentHash,
    latestAttestationSnapshotChainIndex: pub.latestAttestationSnapshotChainIndex,
    chainContinuitySummary: pub.chainContinuitySummary,
    previousPublishedAttestationHeadDigest: pub.previousPublishedAttestationHeadDigest || null
  });
  return crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

function signPayload(pub){
  return canonicalize({
    verifierPackageId: pub.verifierPackageId,
    attestationTrustPublicationId: pub.attestationTrustPublicationId,
    latestAttestationSnapshotId: pub.latestAttestationSnapshotId,
    latestAttestationSnapshotContentHash: pub.latestAttestationSnapshotContentHash,
    latestAttestationSnapshotChainIndex: pub.latestAttestationSnapshotChainIndex,
    attestationChainHeadDigest: pub.attestationChainHeadDigest,
    attestationChainHeadDigestVersion: pub.attestationChainHeadDigestVersion,
    publicationVersion: pub.publicationVersion,
    publishedAt: pub.publishedAt
  });
}

async function listRaw(verifierPackageId){
  const d = dirFor(verifierPackageId);
  const exists = await fs.access(d).then(()=>true).catch(()=>false);
  if (!exists) return [];
  const files = (await fs.readdir(d)).filter((f)=>f.endsWith('.json'));
  const out=[];
  for (const f of files){ try{ out.push(JSON.parse(await fs.readFile(path.join(d,f),'utf8'))); }catch{} }
  out.sort((a,b)=>String(a.publishedAt).localeCompare(String(b.publishedAt)));
  return out;
}

export async function publishAttestationTrust(verifierPackageId){
  const snaps = await listAttestationSnapshots(verifierPackageId);
  if (!(snaps.snapshots || []).length) return { error: 'no_attestation_snapshot_for_publication' };
  const latest = [...snaps.snapshots].sort((a,b)=>Number(b.attestationSnapshotChainIndex||0)-Number(a.attestationSnapshotChainIndex||0))[0];
  const prev = await getLatestAttestationTrustPublication(verifierPackageId);

  const pub = {
    attestationTrustPublicationId: id(),
    verifierPackageId,
    latestAttestationSnapshotId: latest.attestationSnapshotId,
    latestAttestationSnapshotContentHash: latest.attestationSnapshotContentHash,
    latestAttestationSnapshotChainIndex: latest.attestationSnapshotChainIndex,
    previousPublishedAttestationHeadDigest: prev.error ? null : prev.attestationTrustPublication.attestationChainHeadDigest,
    publicationVersion: 'v1',
    publishedAt: new Date().toISOString(),
    trustProfile: { trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev', trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development' },
    publicationStatus: 'active',
    chainContinuitySummary: { isChainRoot: Number(latest.attestationSnapshotChainIndex||0) === 1, parentAttestationSnapshotId: latest.parentAttestationSnapshotId || null }
  };
  pub.attestationChainHeadDigestVersion = DIGEST_VERSION;
  pub.attestationChainHeadDigest = headDigest(pub);

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(signPayload(pub)));
    signer.end();
    pub.attestationTrustPublicationSignature = signer.sign(ctx.privateKey, 'base64');
    pub.attestationTrustPublicationSignatureVersion = SIG_VERSION;
    pub.attestationTrustPublicationSigningKeyId = ctx.signingKeyId;
    pub.attestationTrustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    pub.attestationTrustPublicationSignatureStatus = 'signed';
  } else {
    pub.attestationTrustPublicationSignature = null;
    pub.attestationTrustPublicationSignatureVersion = SIG_VERSION;
    pub.attestationTrustPublicationSigningKeyId = null;
    pub.attestationTrustPublicationSigningAlgorithm = 'RSA-SHA256';
    pub.attestationTrustPublicationSignatureStatus = 'unsigned';
    pub.unsignedReason = ctx.unsignedReason || 'missing_key';
  }

  await fs.mkdir(dirFor(verifierPackageId), { recursive: true });
  const fp = fileFor(verifierPackageId, pub.attestationTrustPublicationId);
  const exists = await fs.access(fp).then(()=>true).catch(()=>false);
  if (exists) return { error: 'attestation_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(pub, null, 2), 'utf8');
  return { attestationTrustPublication: pub };
}

export async function listAttestationTrustPublications(verifierPackageId){
  const rows = await listRaw(verifierPackageId);
  return { attestationTrustPublications: rows.map((p)=>({
    attestationTrustPublicationId: p.attestationTrustPublicationId,
    verifierPackageId: p.verifierPackageId,
    latestAttestationSnapshotId: p.latestAttestationSnapshotId,
    latestAttestationSnapshotContentHash: p.latestAttestationSnapshotContentHash,
    latestAttestationSnapshotChainIndex: p.latestAttestationSnapshotChainIndex,
    attestationChainHeadDigest: p.attestationChainHeadDigest,
    attestationChainHeadDigestVersion: p.attestationChainHeadDigestVersion,
    publicationVersion: p.publicationVersion,
    publishedAt: p.publishedAt,
    attestationTrustPublicationSignatureStatus: p.attestationTrustPublicationSignatureStatus
  })) };
}

export async function getAttestationTrustPublication(verifierPackageId, attestationTrustPublicationId){
  try { return { attestationTrustPublication: JSON.parse(await fs.readFile(fileFor(verifierPackageId, attestationTrustPublicationId), 'utf8')) }; }
  catch { return { error: 'attestation_trust_publication_not_found' }; }
}

export async function getLatestAttestationTrustPublication(verifierPackageId){
  const rows = await listRaw(verifierPackageId);
  if (!rows.length) return { error: 'attestation_trust_publication_not_found' };
  return { attestationTrustPublication: rows[rows.length - 1] };
}
