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
import { createReviewedSnapshot, getReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
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
if (init.reviewed.reviewStatus !== 'draft') throw new Error('init status mismatch');

const secId = init.reviewed.sections[0].sectionId;
const edited = await updateReviewedSection(scriptId, secId, { narrationText: 'Click Login to authenticate the user.', timing: { estimatedDurationMs: 2200, leadInMs: 200, leadOutMs: 200 } }, 'fixture');
if (edited.error) throw new Error(`edit failed: ${edited.error}`);
if (!edited.diff.sections[secId] || edited.diff.sections[secId].state === 'unchanged') throw new Error('diff not reflecting edit');

const noted = await addReviewedSectionNote(scriptId, secId, 'Pronounce as log-in.', 'fixture');
if (noted.error) throw new Error(`note failed: ${noted.error}`);

const ids = noted.reviewed.sections.map((s) => s.sectionId).reverse();
const reordered = await reorderReviewedSections(scriptId, ids, 'fixture');
if (reordered.error) throw new Error(`reorder failed: ${reordered.error}`);

const gateFail = evaluatePublishGate({ baseline: reordered.baseline, reviewed: reordered.reviewed });
if (gateFail.canPublish) throw new Error('gate should fail before approval');

const inReview = await updateReviewedStatus(scriptId, { targetStatus: 'in_review', actor: 'fixture' });
if (inReview.error) throw new Error(`status in_review failed: ${inReview.error}`);
const approved = await updateReviewedStatus(scriptId, { targetStatus: 'approved', actor: 'fixture' });
if (approved.error) throw new Error(`status approved failed: ${approved.error}`);

const gatePass = evaluatePublishGate({ baseline: approved.baseline, reviewed: approved.reviewed });
if (!gatePass.canPublish) throw new Error(`gate expected pass: ${gatePass.blockingReasons.join(',')}`);

const snap = await createReviewedSnapshot(scriptId, { actor: 'fixture' });
if (snap.error) throw new Error(`snapshot create failed: ${snap.error}`);
const snapId = snap.snapshot.reviewedSnapshotId;

await updateReviewedSection(scriptId, secId, { narrationText: 'Updated after snapshot.' }, 'fixture');
const snapRead = await getReviewedSnapshot(scriptId, snapId);
if (snapRead.error) throw new Error('snapshot read failed');
if (snapRead.snapshot.reviewed.sections[0].narrationText === 'Updated after snapshot.') throw new Error('snapshot immutability broken');

const published = await updateReviewedStatus(scriptId, { targetStatus: 'published_ready', actor: 'fixture' });
if (published.error) throw new Error(`status published_ready failed: ${published.error}`);

const badTransition = await updateReviewedStatus(scriptId, { targetStatus: 'draft', actor: 'fixture' });
if (badTransition.error !== 'invalid_status_transition') throw new Error('expected invalid transition rejection');

const envelope = await getReviewedScript(scriptId);
if (envelope.error) throw new Error(envelope.error);
const md = reviewedExport(envelope, 'markdown', true);
if (md.error || !String(md.content).includes('## Reviewed Sections')) throw new Error('reviewed markdown export invalid');

const report = await buildScriptAuditReport(scriptId);
if (report.error) throw new Error(report.error);
if (!report.report.publishGate || !Array.isArray(report.report.availableReviewedSnapshots)) throw new Error('audit report shape invalid');

const baselineUntouched = created.script.sections[0].narrationText;
if (baselineUntouched !== created.script.sections[0].narrationText) throw new Error('baseline mutation detected');

console.log('OK script review fixtures');
