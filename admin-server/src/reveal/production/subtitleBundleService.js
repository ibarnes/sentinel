import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getVoiceTrackPlan, exportVoiceTrackPlan } from './voiceTrackPlanService.js';
import { getVoicePlanSnapshot } from './voicePlanSnapshotService.js';
import { verifyVoicePlanSnapshotIntegrity, recomputeVoicePlanSnapshotIntegrity } from './voicePlanIntegrityService.js';
import { getLatestTrustPublication } from '../script/reviewedSnapshotTrustPublicationService.js';

const pexec = promisify(execFile);
function id(){ return `sb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function gateResult({ plan, trust, latestSnapshotIntegrity = null, requireLatestVoicePlanSnapshotIntegrity = false, requireLatestTrustPublication = false }) {
  const blockingReasons = [];
  if (requireLatestTrustPublication && trust.error) blockingReasons.push('trust_publication_missing');
  if (requireLatestVoicePlanSnapshotIntegrity) {
    if (!latestSnapshotIntegrity) blockingReasons.push('latest_voice_plan_snapshot_missing');
    else if (latestSnapshotIntegrity.integrityStatus !== 'match') blockingReasons.push('latest_voice_plan_snapshot_integrity_failed');
  }
  if (plan.sourceType === 'reviewed_script' && !['approved','published_ready'].includes(plan.metadata?.sourceApprovalTrust?.reviewStatus || plan.metadata?.sourceApprovalTrust?.publishGate?.reviewStatus || 'approved')) {
    blockingReasons.push('reviewed_script_not_publishable');
  }
  return {
    canExport: blockingReasons.length === 0,
    blockingReasons,
    warnings: [],
    evaluatedAt: new Date().toISOString()
  };
}

export async function buildSubtitleBundle({ voiceTrackPlanId, voicePlanSnapshotId = null, format = 'subtitle_bundle', requireLatestVoicePlanSnapshotIntegrity = false, requireLatestTrustPublication = false } = {}) {
  const got = await getVoiceTrackPlan(voiceTrackPlanId);
  if (got.error) return got;
  const plan = got.voiceTrackPlan;

  let snapshot = null;
  if (voicePlanSnapshotId) {
    const s = await getVoicePlanSnapshot(voiceTrackPlanId, voicePlanSnapshotId);
    if (s.error) return s;
    snapshot = s.snapshot;
  }

  const trust = await getLatestTrustPublication(plan.sourceRef?.scriptId || '');
  const latestSnapshotIntegrity = snapshot ? await verifyVoicePlanSnapshotIntegrity(voiceTrackPlanId, snapshot.voicePlanSnapshotId) : null;

  const gate = gateResult({ plan, trust, latestSnapshotIntegrity, requireLatestVoicePlanSnapshotIntegrity, requireLatestTrustPublication });
  if (!gate.canExport) return { error: 'subtitle_bundle_policy_blocked', gate };

  const manifest = {
    subtitleBundleId: id(),
    bundleVersion: 'v1',
    voiceTrackPlanId,
    voicePlanSnapshotId: snapshot?.voicePlanSnapshotId || null,
    sourceRefs: plan.sourceRef,
    trustRefs: trust.error ? null : { trustPublicationId: trust.trustPublication.trustPublicationId, chainHeadDigest: trust.trustPublication.chainHeadDigest },
    createdAt: new Date().toISOString(),
    readinessState: gate
  };

  const payload = {
    'subtitle-bundle-manifest.json': manifest,
    'voice-track-plan.json': plan,
    'voice-track-plan-snapshot.json': snapshot || null,
    'captions.json': { captions: plan.captions || [], subtitleTracks: plan.subtitleTracks || [] },
    'subtitles.srt': exportVoiceTrackPlan(plan, 'srt').content,
    'subtitles.vtt': exportVoiceTrackPlan(plan, 'vtt').content,
    'trust-summary.json': trust.error ? { status: 'missing' } : trust.trustPublication,
    'integrity-summary.json': {
      voicePlanSnapshotIntegrity: latestSnapshotIntegrity,
      voicePlanSnapshotChain: snapshot ? await recomputeVoicePlanSnapshotIntegrity(voiceTrackPlanId) : null
    }
  };

  if (format === 'json') {
    return { contentType: 'application/json', filename: `${voiceTrackPlanId}-subtitle-bundle.json`, content: JSON.stringify(payload, null, 2) };
  }
  if (format !== 'subtitle_bundle') return { error: 'invalid_subtitle_bundle_format' };

  const tmp = `/tmp/reveal-subtitle-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(tmp, { recursive: true });
  for (const [name, value] of Object.entries(payload)) {
    const p = path.join(tmp, name);
    if (name.endsWith('.srt') || name.endsWith('.vtt')) await fs.writeFile(p, String(value));
    else await fs.writeFile(p, JSON.stringify(value, null, 2));
  }
  const zipPath = `${tmp}.zip`;
  await pexec('zip', ['-X', '-r', zipPath, '.', '-i', '*'], { cwd: tmp });
  const buffer = await fs.readFile(zipPath);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });

  return { contentType: 'application/zip', filename: `${voiceTrackPlanId}-subtitle-bundle.zip`, buffer };
}

export async function buildVoiceTrackAuditReport(voiceTrackPlanId) {
  const got = await getVoiceTrackPlan(voiceTrackPlanId);
  if (got.error) return got;
  const plan = got.voiceTrackPlan;

  const snapshotsDir = `/home/ec2-user/.openclaw/workspace/reveal/storage/voice-track-plan-snapshots/${voiceTrackPlanId}`;
  const hasSnapshots = await fs.access(snapshotsDir).then(()=>true).catch(()=>false);
  const chain = hasSnapshots ? await recomputeVoicePlanSnapshotIntegrity(voiceTrackPlanId) : { totalSnapshots: 0, matched: 0, mismatched: 0, brokenChainLinks: 0, missingHash: 0, firstBrokenSnapshotId: null, rows: [] };
  const latest = chain.rows.length ? chain.rows[chain.rows.length - 1] : null;
  const trust = await getLatestTrustPublication(plan.sourceRef?.scriptId || '');

  const readiness = gateResult({ plan, trust, latestSnapshotIntegrity: latest, requireLatestVoicePlanSnapshotIntegrity: true, requireLatestTrustPublication: false });

  return {
    report: {
      voiceTrackPlanId,
      generatedAt: new Date().toISOString(),
      sourceType: plan.sourceType,
      sourceRef: plan.sourceRef,
      latestVoicePlanSnapshotSummary: latest,
      voicePlanIntegritySummary: chain,
      upstreamSourceTrustRefs: plan.metadata?.sourceApprovalTrust || null,
      subtitleBundleReadiness: readiness
    }
  };
}
