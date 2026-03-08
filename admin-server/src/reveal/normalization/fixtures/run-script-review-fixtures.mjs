import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import {
  initReviewedScript,
  getReviewedScript,
  updateReviewedSection,
  reorderReviewedSections,
  addReviewedSectionNote,
  updateReviewedStatus,
  reviewedExport
} from '../../script/reviewedScriptService.js';
import {
  createReviewedSnapshot,
  getReviewedSnapshot,
  listReviewedSnapshots,
  verifyReviewedSnapshotIntegrity,
  recomputeReviewedSnapshotIntegrity
} from '../../script/reviewedScriptSnapshotService.js';
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

const init = await initReviewedScript(scriptId, { actor: 'fixture' });
if (init.error) throw new Error(`init failed: ${init.error}`);

const secId = init.reviewed.sections[0].sectionId;
const edited = await updateReviewedSection(scriptId, secId, { narrationText: 'Click Login to authenticate the user.', timing: { estimatedDurationMs: 2200, leadInMs: 200, leadOutMs: 200 } }, 'fixture');
if (edited.error) throw new Error(`edit failed: ${edited.error}`);

const noted = await addReviewedSectionNote(scriptId, secId, 'Pronounce as log-in.', 'fixture');
if (noted.error) throw new Error(`note failed: ${noted.error}`);

const ids = noted.reviewed.sections.map((s) => s.sectionId).reverse();
const reordered = await reorderReviewedSections(scriptId, ids, 'fixture');
if (reordered.error) throw new Error(`reorder failed: ${reordered.error}`);

const gateFail = evaluatePublishGate({ baseline: reordered.baseline, reviewed: reordered.reviewed });
if (gateFail.canPublish) throw new Error('gate should fail before approval');

await updateReviewedStatus(scriptId, { targetStatus: 'in_review', actor: 'fixture' });
const approved = await updateReviewedStatus(scriptId, { targetStatus: 'approved', actor: 'fixture' });
if (approved.error) throw new Error(`status approved failed: ${approved.error}`);

const snap1 = await createReviewedSnapshot(scriptId, { actor: 'fixture' });
if (snap1.error) throw new Error(`snapshot1 create failed: ${snap1.error}`);
const s1 = snap1.snapshot.reviewedSnapshotId;
if (snap1.snapshot.reviewedSnapshotChainIndex !== 1) throw new Error('first snapshot chain index must be 1');
if (snap1.snapshot.parentReviewedSnapshotId !== null) throw new Error('first snapshot parent should be null');

const v1 = await verifyReviewedSnapshotIntegrity(scriptId, s1);
if (v1.integrityStatus !== 'match') throw new Error(`snapshot1 integrity expected match, got ${v1.integrityStatus}`);

await updateReviewedSection(scriptId, secId, { narrationText: 'Updated after snapshot.' }, 'fixture');
const snap2 = await createReviewedSnapshot(scriptId, { actor: 'fixture' });
if (snap2.error) throw new Error(`snapshot2 create failed: ${snap2.error}`);
const s2 = snap2.snapshot.reviewedSnapshotId;
if (snap2.snapshot.reviewedSnapshotChainIndex !== 2) throw new Error('second snapshot chain index must be 2');
if (snap2.snapshot.parentReviewedSnapshotId !== s1) throw new Error('second snapshot parent id mismatch');

const list = await listReviewedSnapshots(scriptId);
if ((list.snapshots || []).length < 2) throw new Error('expected at least 2 snapshots');

const snapRead = await getReviewedSnapshot(scriptId, s1);
if (snapRead.error) throw new Error('snapshot read failed');
if (snapRead.snapshot.reviewed.sections[0].narrationText === 'Updated after snapshot.') throw new Error('snapshot immutability broken');

const v1Again = await verifyReviewedSnapshotIntegrity(scriptId, s1);
if (v1.recomputedContentHash !== v1Again.recomputedContentHash) throw new Error('hash stability across rereads failed');

// Tamper snapshot 2 payload and ensure mismatch detection
const s2Path = `/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-script-snapshots/${scriptId}/${s2}.json`;
const s2Obj = JSON.parse(await fs.readFile(s2Path, 'utf8'));
s2Obj.reviewed.sections[0].narrationText = 'tampered';
await fs.writeFile(s2Path, JSON.stringify(s2Obj, null, 2), 'utf8');
const v2Tampered = await verifyReviewedSnapshotIntegrity(scriptId, s2);
if (v2Tampered.integrityStatus !== 'mismatch') throw new Error('tampered snapshot should mismatch');

// Break parent linkage on snapshot 2
s2Obj.parentReviewedSnapshotContentHash = 'deadbeef';
await fs.writeFile(s2Path, JSON.stringify(s2Obj, null, 2), 'utf8');
const v2Broken = await verifyReviewedSnapshotIntegrity(scriptId, s2);
if (v2Broken.integrityStatus !== 'broken_parent_link') throw new Error('broken parent link should be detected');

const recompute = await recomputeReviewedSnapshotIntegrity(scriptId);
if (!Number.isFinite(recompute.totalSnapshots) || !Array.isArray(recompute.rows)) throw new Error('invalid recompute summary shape');

const gateWithIntegrity = evaluatePublishGate({ baseline: approved.baseline, reviewed: approved.reviewed, requireLatestReviewedSnapshotIntegrity: true, latestReviewedSnapshotIntegrity: v2Broken });
if (gateWithIntegrity.canPublish) throw new Error('gate should fail with broken latest snapshot integrity');

await updateReviewedStatus(scriptId, { targetStatus: 'published_ready', actor: 'fixture' });
const badTransition = await updateReviewedStatus(scriptId, { targetStatus: 'draft', actor: 'fixture' });
if (badTransition.error !== 'invalid_status_transition') throw new Error('expected invalid transition rejection');

const envelope = await getReviewedScript(scriptId);
if (envelope.error) throw new Error(envelope.error);
const md = reviewedExport(envelope, 'markdown', true);
if (md.error || !String(md.content).includes('## Reviewed Sections')) throw new Error('reviewed markdown export invalid');

const report = await buildScriptAuditReport(scriptId, { requireLatestReviewedSnapshotIntegrity: true });
if (report.error) throw new Error(report.error);
if (!report.report.publishGate || !report.report.reviewedSnapshotIntegritySummary) throw new Error('audit report shape invalid');

console.log('OK script review fixtures');
