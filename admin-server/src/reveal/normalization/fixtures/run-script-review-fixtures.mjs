import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import {
  initReviewedScript,
  updateReviewedSection,
  reorderReviewedSections,
  addReviewedSectionNote,
  updateReviewedStatus,
  getReviewedScript,
  reviewedExport
} from '../../script/reviewedScriptService.js';
import {
  createReviewedSnapshot,
  getReviewedSnapshot,
  listReviewedSnapshots,
  verifyReviewedSnapshotIntegrity,
  recomputeReviewedSnapshotIntegrity
} from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust, listTrustPublications, getLatestTrustPublication } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { verifyLatestReviewedSnapshot } from '../../script/reviewedSnapshotVerificationService.js';
import { buildProofBundle } from '../../script/reviewedSnapshotProofBundleService.js';
import { evaluatePublishGate } from '../../script/scriptPublishGateService.js';
import { buildScriptAuditReport } from '../../script/scriptAuditReportService.js';

const flowId = 'fixture_script_review_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Script Review Fixture Flow',
  reviewVersion: 1,
  steps: [
    { id: 'r1', index: 1, title: 'Login', action: 'click', intent: 'authenticate', screenshots: {}, annotations: [] },
    { id: 'r2', index: 2, title: 'Dashboard', action: 'navigate', intent: 'open dashboard', screenshots: {}, annotations: [] }
  ]
});

const created = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
if (created.error) throw new Error(created.error);
const scriptId = created.script.scriptId;

await initReviewedScript(scriptId, { actor: 'fixture' });
const env1 = await getReviewedScript(scriptId);
const secId = env1.reviewed.sections[0].sectionId;
await updateReviewedSection(scriptId, secId, { narrationText: 'Click Login to authenticate the user.', timing: { estimatedDurationMs: 2200, leadInMs: 200, leadOutMs: 200 } }, 'fixture');
await addReviewedSectionNote(scriptId, secId, 'Pronounce as log-in.', 'fixture');
const env2 = await getReviewedScript(scriptId);
await reorderReviewedSections(scriptId, env2.reviewed.sections.map((s) => s.sectionId).reverse(), 'fixture');

await updateReviewedStatus(scriptId, { targetStatus: 'in_review', actor: 'fixture' });
const approved = await updateReviewedStatus(scriptId, { targetStatus: 'approved', actor: 'fixture' });
if (approved.error) throw new Error(`status approved failed: ${approved.error}`);

const snap1 = await createReviewedSnapshot(scriptId, { actor: 'fixture' });
if (snap1.snapshot.reviewedSnapshotChainIndex !== 1) throw new Error('first snapshot chain index must be 1');
const s1 = snap1.snapshot.reviewedSnapshotId;
const v1 = await verifyReviewedSnapshotIntegrity(scriptId, s1);
if (v1.integrityStatus !== 'match') throw new Error('snapshot1 expected match');

await updateReviewedSection(scriptId, secId, { narrationText: 'Updated after snapshot.' }, 'fixture');
const snap2 = await createReviewedSnapshot(scriptId, { actor: 'fixture' });
const s2 = snap2.snapshot.reviewedSnapshotId;
if (snap2.snapshot.parentReviewedSnapshotId !== s1) throw new Error('snapshot2 parent mismatch');

const v1b = await verifyReviewedSnapshotIntegrity(scriptId, s1);
if (v1.recomputedContentHash !== v1b.recomputedContentHash) throw new Error('hash instability');

const s2Path = `/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-script-snapshots/${scriptId}/${s2}.json`;
const s2Obj = JSON.parse(await fs.readFile(s2Path, 'utf8'));
s2Obj.reviewed.sections[0].narrationText = 'tampered';
await fs.writeFile(s2Path, JSON.stringify(s2Obj, null, 2), 'utf8');
const v2Tampered = await verifyReviewedSnapshotIntegrity(scriptId, s2);
if (v2Tampered.integrityStatus !== 'mismatch') throw new Error('tamper should mismatch');

s2Obj.parentReviewedSnapshotContentHash = 'deadbeef';
await fs.writeFile(s2Path, JSON.stringify(s2Obj, null, 2), 'utf8');
const v2Broken = await verifyReviewedSnapshotIntegrity(scriptId, s2);
if (v2Broken.integrityStatus !== 'broken_parent_link') throw new Error('broken parent not detected');

const recompute = await recomputeReviewedSnapshotIntegrity(scriptId);
if (!recompute.totalSnapshots || !Array.isArray(recompute.rows)) throw new Error('invalid recompute summary');

// publish gate with integrity requirement should fail now
const gateIntegrityReq = evaluatePublishGate({ baseline: approved.baseline, reviewed: approved.reviewed, requireLatestReviewedSnapshotIntegrity: true, latestReviewedSnapshotIntegrity: v2Broken });
if (gateIntegrityReq.canPublish) throw new Error('expected gate fail with broken integrity');

// trust publication append-only behavior
const pub1 = await publishTrust(scriptId);
if (pub1.error) throw new Error(`trust publication failed: ${pub1.error}`);
const pub2 = await publishTrust(scriptId);
if (pub2.error) throw new Error(`trust publication 2 failed: ${pub2.error}`);
const pubs = await listTrustPublications(scriptId);
if ((pubs.trustPublications || []).length < 2) throw new Error('expected trust publication history');

const latestPub = await getLatestTrustPublication(scriptId);
if (latestPub.error) throw new Error('latest trust publication missing');
if (!latestPub.trustPublication.chainHeadDigest) throw new Error('missing chainHeadDigest');

const verifier = await verifyLatestReviewedSnapshot(scriptId);
if (!verifier.chainHeadDigest || !verifier.integritySummary) throw new Error('verifier payload missing fields');

const proofJson = await buildProofBundle(scriptId, { format: 'json' });
if (proofJson.error || !String(proofJson.content).includes('proofBundleId')) throw new Error('proof json bundle invalid');

const badTrustGate = evaluatePublishGate({
  baseline: approved.baseline,
  reviewed: approved.reviewed,
  requireLatestReviewedSnapshotIntegrity: true,
  latestReviewedSnapshotIntegrity: v2Broken
});
if (badTrustGate.canPublish) throw new Error('expected publish gate failure under required integrity');

await updateReviewedStatus(scriptId, { targetStatus: 'published_ready', actor: 'fixture' });
const md = reviewedExport(await getReviewedScript(scriptId), 'markdown', true);
if (md.error) throw new Error('reviewed markdown export invalid');

const report = await buildScriptAuditReport(scriptId, { requireLatestReviewedSnapshotIntegrity: true });
if (report.error || !report.report.reviewedSnapshotIntegritySummary) throw new Error('audit report invalid');

const snapRead = await getReviewedSnapshot(scriptId, s1);
if (snapRead.snapshot.reviewed.sections[0].narrationText === 'Updated after snapshot.') throw new Error('snapshot immutability broken');

console.log('OK script review fixtures');
