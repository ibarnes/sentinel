import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { createExternalVerifierProfile } from '../../verification/externalVerifierProfileService.js';
import { createRenderAdapterContract, exportRenderAdapterContract } from '../../production/renderAdapterContractService.js';
import { validateAdapterContract } from '../../production/adapterValidationService.js';

const flowId = 'fixture_render_adapter_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Render Adapter Fixture',
  reviewVersion: 1,
  steps: [
    { id: 'ra1', index: 1, title: 'Open', action: 'navigate', intent: 'open', screenshots: {}, annotations: [] },
    { id: 'ra2', index: 2, title: 'Upload', action: 'upload', intent: 'upload', screenshots: {}, annotations: [] }
  ]
});

const script = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
await initReviewedScript(script.script.scriptId, { actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'in_review', actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'approved', actor: 'fixture' });
await createReviewedSnapshot(script.script.scriptId, { actor: 'fixture' });
await publishTrust(script.script.scriptId);

const shot = await createShotList({ scriptId: script.script.scriptId, publishReady: true });
const voice = await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true });
const unified = await createUnifiedVerifierPackage({ scriptId: script.script.scriptId, shotListId: shot.shotList.shotListId, voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId, orchestrationPolicyProfile: 'internal_verified' });
const external = await createExternalVerifierProfile({ verifierPackageId: unified.verifierPackage.verifierPackageId, policyProfileId: 'dev', mode: 'explicit_refs' });

const c1 = await createRenderAdapterContract({
  adapterType: 'composite_render',
  orchestrationProfile: 'internal_verified',
  verifierPackageId: unified.verifierPackage.verifierPackageId,
  shotListId: shot.shotList.shotListId,
  voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId
});
if (c1.error) throw new Error(`contract from verifier failed: ${c1.error}`);
if (!c1.renderAdapterContract.executionPlan?.stages?.length) throw new Error('missing execution plan stages');

const c2 = await createRenderAdapterContract({
  adapterType: 'narrated_walkthrough',
  orchestrationProfile: 'dev',
  externalVerifierProfileId: external.externalVerifierProfile.externalVerifierProfileId,
  shotListId: shot.shotList.shotListId,
  voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId,
  renderPlanId: 'rp_demo'
});
if (c2.error) throw new Error(`contract from external failed: ${c2.error}`);
if (!['ready','ready_with_warnings','blocked'].includes(c2.renderAdapterContract.readinessState)) throw new Error('invalid readiness');

const manifest = exportRenderAdapterContract(c1.renderAdapterContract, 'adapter_manifest');
if (manifest.error || !String(manifest.content).includes('executionPlan')) throw new Error('adapter manifest invalid');

const md = exportRenderAdapterContract(c2.renderAdapterContract, 'markdown');
if (md.error || !String(md.content).includes('## Execution Plan')) throw new Error('markdown export invalid');

const valid = validateAdapterContract(c1.renderAdapterContract);
if (!['valid','valid_with_warnings','blocked'].includes(valid.status)) throw new Error('unexpected validation status');

const invalid = validateAdapterContract({ adapterType: 'bad' });
if (invalid.status !== 'malformed_contract') throw new Error('expected malformed contract');

console.log('OK render adapter fixtures');
