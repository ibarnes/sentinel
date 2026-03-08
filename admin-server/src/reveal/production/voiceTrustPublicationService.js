import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { listVoicePlanSnapshots } from './voicePlanSnapshotService.js';
import { verifyVoicePlanSnapshotIntegrity } from './voicePlanIntegrityService.js';
import { getSigningContext } from '../services/packageSigningService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/voice-trust-publications';
const DIGEST_VERSION = 'sha256-v1';
const SIG_VERSION = 'voice-trust-sig-v1';

function dirFor(voiceTrackPlanId){ return path.join(ROOT, voiceTrackPlanId); }
function fileFor(voiceTrackPlanId, voiceTrustPublicationId){ return path.join(dirFor(voiceTrackPlanId), `${voiceTrustPublicationId}.json`); }
function id(){ return `vtpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

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

function signingPayload(pub){
  return canonicalize({
    voiceTrackPlanId: pub.voiceTrackPlanId,
    voiceTrustPublicationId: pub.voiceTrustPublicationId,
    latestVoicePlanSnapshotId: pub.latestVoicePlanSnapshotId,
    latestVoicePlanSnapshotContentHash: pub.latestVoicePlanSnapshotContentHash,
    latestVoicePlanSnapshotChainIndex: pub.latestVoicePlanSnapshotChainIndex,
    voiceChainHeadDigest: pub.voiceChainHeadDigest,
    voiceChainHeadDigestVersion: pub.voiceChainHeadDigestVersion,
    previousPublishedVoiceHeadDigest: pub.previousPublishedVoiceHeadDigest || null,
    publicationVersion: pub.publicationVersion,
    publishedAt: pub.publishedAt
  });
}

function headDigest(pub){
  const p = canonicalize({
    voiceTrackPlanId: pub.voiceTrackPlanId,
    publicationVersion: pub.publicationVersion,
    latestVoicePlanSnapshotId: pub.latestVoicePlanSnapshotId,
    latestVoicePlanSnapshotContentHash: pub.latestVoicePlanSnapshotContentHash,
    latestVoicePlanSnapshotChainIndex: pub.latestVoicePlanSnapshotChainIndex,
    chainContinuitySummary: pub.chainContinuitySummary,
    previousPublishedVoiceHeadDigest: pub.previousPublishedVoiceHeadDigest || null
  });
  return crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

async function listRaw(voiceTrackPlanId){
  const d = dirFor(voiceTrackPlanId);
  const exists = await fs.access(d).then(()=>true).catch(()=>false);
  if (!exists) return [];
  const files = (await fs.readdir(d)).filter((f)=>f.endsWith('.json'));
  const out = [];
  for (const f of files){ try{ out.push(JSON.parse(await fs.readFile(path.join(d,f),'utf8'))); } catch {} }
  out.sort((a,b)=>String(a.publishedAt).localeCompare(String(b.publishedAt)));
  return out;
}

export async function listVoiceTrustPublications(voiceTrackPlanId){
  const pubs = await listRaw(voiceTrackPlanId);
  return { voiceTrustPublications: pubs.map((p)=>({
    voiceTrustPublicationId: p.voiceTrustPublicationId,
    voiceTrackPlanId: p.voiceTrackPlanId,
    latestVoicePlanSnapshotId: p.latestVoicePlanSnapshotId,
    latestVoicePlanSnapshotContentHash: p.latestVoicePlanSnapshotContentHash,
    latestVoicePlanSnapshotChainIndex: p.latestVoicePlanSnapshotChainIndex,
    voiceChainHeadDigest: p.voiceChainHeadDigest,
    voiceChainHeadDigestVersion: p.voiceChainHeadDigestVersion,
    publicationVersion: p.publicationVersion,
    publishedAt: p.publishedAt,
    voiceTrustPublicationSignatureStatus: p.voiceTrustPublicationSignatureStatus,
    publicationStatus: p.publicationStatus
  }))};
}

export async function getVoiceTrustPublication(voiceTrackPlanId, voiceTrustPublicationId){
  try { return { voiceTrustPublication: JSON.parse(await fs.readFile(fileFor(voiceTrackPlanId, voiceTrustPublicationId), 'utf8')) }; }
  catch { return { error: 'voice_trust_publication_not_found' }; }
}

export async function getLatestVoiceTrustPublication(voiceTrackPlanId){
  const pubs = await listRaw(voiceTrackPlanId);
  if (!pubs.length) return { error: 'voice_trust_publication_not_found' };
  return { voiceTrustPublication: pubs[pubs.length - 1] };
}

export async function publishVoiceTrust(voiceTrackPlanId){
  const snaps = await listVoicePlanSnapshots(voiceTrackPlanId);
  if (!(snaps.snapshots || []).length) return { error: 'no_voice_snapshot_for_publication' };
  const latest = [...snaps.snapshots].sort((a,b)=>Number(b.voicePlanSnapshotChainIndex||0)-Number(a.voicePlanSnapshotChainIndex||0))[0];
  const integ = await verifyVoicePlanSnapshotIntegrity(voiceTrackPlanId, latest.voicePlanSnapshotId);

  const prev = await getLatestVoiceTrustPublication(voiceTrackPlanId);
  const pub = {
    voiceTrackPlanId,
    voiceTrustPublicationId: id(),
    latestVoicePlanSnapshotId: latest.voicePlanSnapshotId,
    latestVoicePlanSnapshotContentHash: latest.voicePlanSnapshotContentHash,
    latestVoicePlanSnapshotChainIndex: latest.voicePlanSnapshotChainIndex,
    previousPublishedVoiceHeadDigest: prev.error ? null : prev.voiceTrustPublication.voiceChainHeadDigest,
    publicationVersion: 'v1',
    publishedAt: new Date().toISOString(),
    trustProfile: {
      trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev',
      trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development'
    },
    publicationStatus: 'active',
    chainContinuitySummary: {
      latestIntegrityStatus: integ.integrityStatus,
      parentVoicePlanSnapshotId: latest.parentVoicePlanSnapshotId || null,
      isChainRoot: Number(latest.voicePlanSnapshotChainIndex||0) === 1
    }
  };
  pub.voiceChainHeadDigestVersion = DIGEST_VERSION;
  pub.voiceChainHeadDigest = headDigest(pub);

  const ctx = await getSigningContext();
  if (ctx.enabled) {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(JSON.stringify(signingPayload(pub)));
    signer.end();
    pub.voiceTrustPublicationSignature = signer.sign(ctx.privateKey, 'base64');
    pub.voiceTrustPublicationSignatureVersion = SIG_VERSION;
    pub.voiceTrustPublicationSigningKeyId = ctx.signingKeyId;
    pub.voiceTrustPublicationSigningAlgorithm = ctx.signingAlgorithm;
    pub.voiceTrustPublicationSignatureStatus = 'signed';
    pub.signerMetadata = { signerKeyFingerprint: ctx.signerKeyFingerprint, publicKeyHint: ctx.publicKeyHint };
  } else {
    pub.voiceTrustPublicationSignature = null;
    pub.voiceTrustPublicationSignatureVersion = SIG_VERSION;
    pub.voiceTrustPublicationSigningKeyId = null;
    pub.voiceTrustPublicationSigningAlgorithm = 'RSA-SHA256';
    pub.voiceTrustPublicationSignatureStatus = 'unsigned';
    pub.unsignedReason = ctx.unsignedReason || 'missing_key';
    pub.signerMetadata = null;
  }

  await fs.mkdir(dirFor(voiceTrackPlanId), { recursive: true });
  const fp = fileFor(voiceTrackPlanId, pub.voiceTrustPublicationId);
  const exists = await fs.access(fp).then(()=>true).catch(()=>false);
  if (exists) return { error: 'voice_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(pub, null, 2), 'utf8');

  return { voiceTrustPublication: pub };
}

export { signingPayload as buildVoiceTrustSigningPayload };
