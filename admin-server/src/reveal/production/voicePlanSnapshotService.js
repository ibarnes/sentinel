import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getVoiceTrackPlan } from './voiceTrackPlanService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/voice-track-plan-snapshots';
const HASH_VERSION = 'sha256-v1';

function dirFor(voiceTrackPlanId){ return path.join(ROOT, voiceTrackPlanId); }
function fileFor(voiceTrackPlanId, voicePlanSnapshotId){ return path.join(dirFor(voiceTrackPlanId), `${voicePlanSnapshotId}.json`); }
function id(){ return `vps_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

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

function hashPayload(snapshot){
  return canonicalize({
    voicePlanSnapshotId: snapshot.voicePlanSnapshotId,
    voiceTrackPlanId: snapshot.voiceTrackPlanId,
    sourceType: snapshot.sourceType,
    sourceRef: snapshot.sourceRef,
    voiceTrackPlanVersion: snapshot.voiceTrackPlanVersion,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    sourceScriptId: snapshot.sourceScriptId,
    sourceReviewedSnapshotId: snapshot.sourceReviewedSnapshotId,
    sourceShotListId: snapshot.sourceShotListId,
    sourceShotListSnapshotId: snapshot.sourceShotListSnapshotId,
    sourceTrustRefs: snapshot.sourceTrustRefs,
    parentVoicePlanSnapshotId: snapshot.parentVoicePlanSnapshotId,
    parentVoicePlanSnapshotContentHash: snapshot.parentVoicePlanSnapshotContentHash,
    voicePlanSnapshotChainIndex: snapshot.voicePlanSnapshotChainIndex,
    frozenVoiceTrackPlan: snapshot.frozenVoiceTrackPlan
  });
}

function computeHash(snapshot){
  return crypto.createHash('sha256').update(JSON.stringify(hashPayload(snapshot))).digest('hex');
}

async function listRaw(voiceTrackPlanId){
  const d = dirFor(voiceTrackPlanId);
  const exists = await fs.access(d).then(()=>true).catch(()=>false);
  if (!exists) return [];
  const files = (await fs.readdir(d)).filter((f)=>f.endsWith('.json'));
  const out = [];
  for (const f of files){
    try { out.push(JSON.parse(await fs.readFile(path.join(d,f),'utf8'))); } catch {}
  }
  out.sort((a,b)=>Number(a.voicePlanSnapshotChainIndex||0)-Number(b.voicePlanSnapshotChainIndex||0));
  return out;
}

export async function createVoicePlanSnapshot(voiceTrackPlanId, { createdBy = null } = {}) {
  const got = await getVoiceTrackPlan(voiceTrackPlanId);
  if (got.error) return got;
  const plan = got.voiceTrackPlan;

  const prior = await listRaw(voiceTrackPlanId);
  const parent = prior.length ? prior[prior.length - 1] : null;

  const snapshot = {
    voicePlanSnapshotId: id(),
    voiceTrackPlanId,
    sourceType: plan.sourceType,
    sourceRef: plan.sourceRef,
    voiceTrackPlanVersion: plan.voiceTrackPlanVersion,
    createdAt: new Date().toISOString(),
    createdBy,
    sourceScriptId: plan.sourceRef?.scriptId || null,
    sourceReviewedSnapshotId: plan.sourceRef?.reviewedSnapshotId || null,
    sourceShotListId: plan.sourceRef?.shotListId || null,
    sourceShotListSnapshotId: plan.sourceRef?.shotListSnapshotId || null,
    sourceTrustRefs: plan.metadata?.sourceApprovalTrust || null,
    parentVoicePlanSnapshotId: parent?.voicePlanSnapshotId || null,
    parentVoicePlanSnapshotContentHash: parent?.voicePlanSnapshotContentHash || null,
    voicePlanSnapshotChainIndex: Number(parent?.voicePlanSnapshotChainIndex || 0) + 1,
    voicePlanSnapshotHashVersion: HASH_VERSION,
    frozenVoiceTrackPlan: plan
  };

  snapshot.voicePlanSnapshotContentHash = computeHash(snapshot);
  snapshot.manifest = {
    voicePlanSnapshotId: snapshot.voicePlanSnapshotId,
    voiceTrackPlanId: snapshot.voiceTrackPlanId,
    voiceTrackPlanVersion: snapshot.voiceTrackPlanVersion,
    totalSegmentCount: (plan.segments || []).length,
    totalCaptionCount: (plan.captions || []).length,
    subtitleTrackSummary: plan.subtitleTracks || [],
    totalEstimatedDurationMs: plan.totalEstimatedDurationMs,
    sourceApprovalTrust: snapshot.sourceTrustRefs,
    voicePlanSnapshotContentHash: snapshot.voicePlanSnapshotContentHash,
    voicePlanSnapshotHashVersion: snapshot.voicePlanSnapshotHashVersion,
    parentVoicePlanSnapshotId: snapshot.parentVoicePlanSnapshotId,
    parentVoicePlanSnapshotContentHash: snapshot.parentVoicePlanSnapshotContentHash,
    voicePlanSnapshotChainIndex: snapshot.voicePlanSnapshotChainIndex,
    exportAvailability: { json: true, markdown: true, srt: true, vtt: true, subtitle_bundle: true },
    createdAt: snapshot.createdAt
  };

  await fs.mkdir(dirFor(voiceTrackPlanId), { recursive: true });
  const fp = fileFor(voiceTrackPlanId, snapshot.voicePlanSnapshotId);
  const exists = await fs.access(fp).then(()=>true).catch(()=>false);
  if (exists) return { error: 'voice_plan_snapshot_id_collision' };
  await fs.writeFile(fp, JSON.stringify(snapshot, null, 2), 'utf8');
  return { snapshot };
}

export async function listVoicePlanSnapshots(voiceTrackPlanId) {
  const rows = await listRaw(voiceTrackPlanId);
  return { snapshots: rows.map((s) => ({
    voicePlanSnapshotId: s.voicePlanSnapshotId,
    voiceTrackPlanId: s.voiceTrackPlanId,
    createdAt: s.createdAt,
    voicePlanSnapshotContentHash: s.voicePlanSnapshotContentHash,
    voicePlanSnapshotHashVersion: s.voicePlanSnapshotHashVersion,
    parentVoicePlanSnapshotId: s.parentVoicePlanSnapshotId,
    parentVoicePlanSnapshotContentHash: s.parentVoicePlanSnapshotContentHash,
    voicePlanSnapshotChainIndex: s.voicePlanSnapshotChainIndex,
    manifest: s.manifest
  })) };
}

export async function getVoicePlanSnapshot(voiceTrackPlanId, voicePlanSnapshotId) {
  try {
    const snapshot = JSON.parse(await fs.readFile(fileFor(voiceTrackPlanId, voicePlanSnapshotId), 'utf8'));
    return { snapshot };
  } catch {
    return { error: 'voice_plan_snapshot_not_found' };
  }
}

export { computeHash as computeVoicePlanSnapshotHash };
