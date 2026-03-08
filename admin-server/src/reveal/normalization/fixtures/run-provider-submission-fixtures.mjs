import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { createRenderAdapterContract } from '../../production/renderAdapterContractService.js';
import { createProviderAdapter } from '../../production/providerAdapterService.js';
import { createProviderSubmissionContract, validateProviderSubmission, listProviderSubmissionContracts, exportProviderSubmissionContract } from '../../production/providerSubmissionService.js';
import { createExecutionReceipt, patchExecutionReceipt, listExecutionReceipts, exportExecutionReceipt } from '../../production/executionReceiptService.js';

const flowId = 'fixture_provider_submission_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Provider Submission Fixture',
  reviewVersion: 1,
  steps: [
    { id: 's1', index: 1, title: 'One', action: 'navigate', intent: 'one', screenshots: {}, annotations: [] },
    { id: 's2', index: 2, title: 'Two', action: 'click', intent: 'two', screenshots: {}, annotations: [] }
  ]
});

const script = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
await initReviewedScript(script.script.scriptId, { actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'in_review', actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'approved', actor: 'fixture' });
await createReviewedSnapshot(script.script.scriptId, { actor: 'fixture' });

const shot = await createShotList({ scriptId: script.script.scriptId, publishReady: true });
const voice = await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true });
const unified = await createUnifiedVerifierPackage({ scriptId: script.script.scriptId, shotListId: shot.shotList.shotListId, voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId, orchestrationPolicyProfile: 'internal_verified' });

const rac = await createRenderAdapterContract({ adapterType: 'narrated_walkthrough', orchestrationProfile: 'internal_verified', verifierPackageId: unified.verifierPackage.verifierPackageId, shotListId: shot.shotList.shotListId, voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId });
if (rac.error) throw new Error(rac.error);

const pa = await createProviderAdapter({ renderAdapterContractId: rac.renderAdapterContract.renderAdapterContractId, providerType: 'generic_renderer', providerProfileId: 'default' });
if (pa.error) throw new Error(pa.error);

const sub = await createProviderSubmissionContract({ providerAdapterId: pa.providerAdapter.providerAdapterId, submissionMode: 'handoff_only' });
if (sub.error) throw new Error(sub.error);
const sub2 = await createProviderSubmissionContract({ providerAdapterId: pa.providerAdapter.providerAdapterId, submissionMode: 'handoff_only' });
if (sub.providerSubmissionContract.payloadDigest !== sub2.providerSubmissionContract.payloadDigest) throw new Error('submission digest should be stable');

const subValid = await validateProviderSubmission({ providerSubmissionContractId: sub.providerSubmissionContract.providerSubmissionContractId });
if (subValid.status !== 'valid') throw new Error('submission should validate');

const subBlocked = await validateProviderSubmission({
  submissionPayload: { ...sub.providerSubmissionContract.submissionPayload, trustRefs: {}, admissionRefs: {}, handoffRefs: {} },
  policyProfile: 'production_verified'
});
if (subBlocked.status !== 'blocked') throw new Error('strict missing refs should block');

const rec = await createExecutionReceipt({ providerSubmissionContractId: sub.providerSubmissionContract.providerSubmissionContractId });
if (rec.error) throw new Error(rec.error);
let receipt = rec.executionReceipt;

receipt = (await patchExecutionReceipt(receipt.executionReceiptId, { action: 'markDispatchReady' })).executionReceipt;
receipt = (await patchExecutionReceipt(receipt.executionReceiptId, { action: 'recordHandoff', externalExecutionRef: 'ext_1' })).executionReceipt;
receipt = (await patchExecutionReceipt(receipt.executionReceiptId, { action: 'recordAcknowledgement', externalExecutionRef: 'ext_1', providerMessage: 'ok', responseCode: '202' })).executionReceipt;
if (receipt.submissionStatus !== 'acknowledged') throw new Error('expected acknowledged status');

const illegal = await patchExecutionReceipt(receipt.executionReceiptId, { action: 'recordHandoff' });
if (illegal.error !== 'illegal_status_transition') throw new Error('illegal transition should fail');

const listSubs = await listProviderSubmissionContracts({ providerType: 'generic_renderer' });
if (!(listSubs.providerSubmissionContracts || []).length) throw new Error('submission listing should return rows');

const listReceipts = await listExecutionReceipts({ providerType: 'generic_renderer', schedulerStatus: 'provider_acknowledged' });
if (!(listReceipts.executionReceipts || []).length) throw new Error('receipt listing should return rows');

const subMd = exportProviderSubmissionContract(sub.providerSubmissionContract, 'markdown');
if (subMd.error || !String(subMd.content).includes('Payload Digest')) throw new Error('submission markdown export invalid');

const recMd = exportExecutionReceipt(receipt, 'markdown');
if (recMd.error || !String(recMd.content).includes('Lifecycle Events')) throw new Error('receipt markdown export invalid');

console.log('OK provider submission fixtures');
