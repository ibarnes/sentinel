import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan, exportVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createVoicePlanSnapshot, getVoicePlanSnapshot, listVoicePlanSnapshots } from '../../production/voicePlanSnapshotService.js';
import { verifyVoicePlanSnapshotIntegrity, recomputeVoicePlanSnapshotIntegrity } from '../../production/voicePlanIntegrityService.js';
import { buildSubtitleBundle, buildVoiceTrackAuditReport } from '../../production/subtitleBundleService.js';

const flowId = 'fixture_voice_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Voice Fixture Flow',
  reviewVersion: 1,
  steps: [
    { id: 'v1', index: 1, title: 'Open Dashboard', action: 'navigate', intent: 'open dashboard view', screenshots: {}, annotations: [] },
    { id: 'v2', index: 2, title: 'Upload CSV', action: 'upload', intent: 'upload customer csv for analysis', screenshots: {}, annotations: [{ author: 'qa', text: 'Use sample' }] }
  ]
});

const script = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
if (script.error) throw new Error(script.error);
await initReviewedScript(script.script.scriptId, { actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'in_review', actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'approved', actor: 'fixture' });
await createReviewedSnapshot(script.script.scriptId, { actor: 'fixture' });
await publishTrust(script.script.scriptId);

const fromScript = await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true });
if (fromScript.error) throw new Error(`voice from script failed: ${fromScript.error}`);

const shot = await createShotList({ scriptId: script.script.scriptId, publishReady: true });
if (shot.error) throw new Error(shot.error);
const fromShot = await createVoiceTrackPlan({ shotListId: shot.shotList.shotListId });
if (fromShot.error) throw new Error(`voice from shot list failed: ${fromShot.error}`);

const srt = exportVoiceTrackPlan(fromScript.voiceTrackPlan, 'srt');
if (srt.error || !String(srt.content).includes('-->')) throw new Error('invalid srt export');
const vtt = exportVoiceTrackPlan(fromScript.voiceTrackPlan, 'vtt');
if (vtt.error || !String(vtt.content).startsWith('WEBVTT')) throw new Error('invalid vtt export');
const md = exportVoiceTrackPlan(fromScript.voiceTrackPlan, 'markdown');
if (md.error || !String(md.content).includes('## Segments')) throw new Error('invalid markdown export');

const stableA = fromScript.voiceTrackPlan.totalEstimatedDurationMs;
const stableB = (await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true })).voiceTrackPlan.totalEstimatedDurationMs;
if (stableA !== stableB) throw new Error('timing stability failed');

// snapshots + chain/hash
const vpId = fromScript.voiceTrackPlan.voiceTrackPlanId;
const snap1 = await createVoicePlanSnapshot(vpId, { createdBy: 'fixture' });
if (snap1.error) throw new Error(snap1.error);
if (snap1.snapshot.voicePlanSnapshotChainIndex !== 1) throw new Error('voice snapshot root index should be 1');
const snap2 = await createVoicePlanSnapshot(vpId, { createdBy: 'fixture' });
if (snap2.error) throw new Error(snap2.error);
if (snap2.snapshot.parentVoicePlanSnapshotId !== snap1.snapshot.voicePlanSnapshotId) throw new Error('voice snapshot parent link mismatch');

const verify1 = await verifyVoicePlanSnapshotIntegrity(vpId, snap1.snapshot.voicePlanSnapshotId);
if (verify1.integrityStatus !== 'match') throw new Error('snapshot integrity expected match');

// hash stability reread
const verify1b = await verifyVoicePlanSnapshotIntegrity(vpId, snap1.snapshot.voicePlanSnapshotId);
if (verify1.recomputedContentHash !== verify1b.recomputedContentHash) throw new Error('hash stability failed');

// mutate working plan; old snapshot should not change
const p = `/home/ec2-user/.openclaw/workspace/reveal/storage/voice-track-plans/${vpId}.json`;
const planObj = JSON.parse(await fs.readFile(p, 'utf8'));
planObj.segments[0].narrationText = 'mutated working plan';
await fs.writeFile(p, JSON.stringify(planObj, null, 2), 'utf8');
const snapRead = await getVoicePlanSnapshot(vpId, snap1.snapshot.voicePlanSnapshotId);
if (snapRead.snapshot.frozenVoiceTrackPlan.segments[0].narrationText === 'mutated working plan') throw new Error('snapshot mutated from working plan changes');

// tamper detection
const s2Path = `/home/ec2-user/.openclaw/workspace/reveal/storage/voice-track-plan-snapshots/${vpId}/${snap2.snapshot.voicePlanSnapshotId}.json`;
const s2Obj = JSON.parse(await fs.readFile(s2Path, 'utf8'));
s2Obj.frozenVoiceTrackPlan.segments[0].narrationText = 'tampered snapshot';
await fs.writeFile(s2Path, JSON.stringify(s2Obj, null, 2), 'utf8');
const tampered = await verifyVoicePlanSnapshotIntegrity(vpId, snap2.snapshot.voicePlanSnapshotId);
if (tampered.integrityStatus !== 'mismatch') throw new Error('tampered snapshot should mismatch');

// broken parent linkage detection
s2Obj.parentVoicePlanSnapshotContentHash = 'deadbeef';
await fs.writeFile(s2Path, JSON.stringify(s2Obj, null, 2), 'utf8');
const broken = await verifyVoicePlanSnapshotIntegrity(vpId, snap2.snapshot.voicePlanSnapshotId);
if (broken.integrityStatus !== 'broken_parent_link') throw new Error('broken parent link not detected');

const recompute = await recomputeVoicePlanSnapshotIntegrity(vpId);
if (!Number.isFinite(recompute.totalSnapshots) || !Array.isArray(recompute.rows)) throw new Error('invalid recompute summary');

// subtitle bundle structure + policy blocking
const bundleJson = await buildSubtitleBundle({ voiceTrackPlanId: vpId, format: 'json' });
if (bundleJson.error) throw new Error(`bundle json failed: ${bundleJson.error}`);
const bundleObj = JSON.parse(bundleJson.content);
if (!bundleObj['subtitle-bundle-manifest.json'] || !bundleObj['subtitles.srt'] || !bundleObj['subtitles.vtt']) throw new Error('bundle structure invalid');

const blockedBundle = await buildSubtitleBundle({ voiceTrackPlanId: vpId, voicePlanSnapshotId: snap2.snapshot.voicePlanSnapshotId, format: 'subtitle_bundle', requireLatestVoicePlanSnapshotIntegrity: true });
if (blockedBundle.error !== 'subtitle_bundle_policy_blocked') throw new Error('expected policy block for broken latest snapshot integrity');

const report = await buildVoiceTrackAuditReport(vpId);
if (report.error || !report.report.voicePlanIntegritySummary) throw new Error('audit report invalid');

const scriptUnapproved = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
await initReviewedScript(scriptUnapproved.script.scriptId, { actor: 'fixture' });
const blocked = await createVoiceTrackPlan({ scriptId: scriptUnapproved.script.scriptId, publishReady: true });
if (blocked.error !== 'script_not_approved') throw new Error('expected unapproved script block');

console.log('OK voice track fixtures');
