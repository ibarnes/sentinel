import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { createRenderAdapterContract } from '../../production/renderAdapterContractService.js';
import { createProviderAdapter, validateProviderAdapter, exportProviderAdapter } from '../../production/providerAdapterService.js';

const flowId = 'fixture_provider_adapter_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Provider Adapter Fixture Flow',
  reviewVersion: 1,
  steps: [
    { id: 'x1', index: 1, title: 'Start', action: 'navigate', intent: 'start', screenshots: {}, annotations: [] },
    { id: 'x2', index: 2, title: 'Continue', action: 'click', intent: 'continue', screenshots: {}, annotations: [] }
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

const composite = await createRenderAdapterContract({
  adapterType: 'composite_render',
  orchestrationProfile: 'internal_verified',
  verifierPackageId: unified.verifierPackage.verifierPackageId,
  shotListId: shot.shotList.shotListId,
  voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId
});
if (composite.error) throw new Error(composite.error);

const genericProvider = await createProviderAdapter({
  renderAdapterContractId: composite.renderAdapterContract.renderAdapterContractId,
  providerType: 'generic_renderer',
  providerProfileId: 'default'
});
if (genericProvider.error) throw new Error(genericProvider.error);
if (!['ready','ready_with_warnings'].includes(genericProvider.providerAdapter.readinessState)) throw new Error('generic provider should be ready-ish');

const subtitleBlocked = await createProviderAdapter({
  renderAdapterContractId: composite.renderAdapterContract.renderAdapterContractId,
  providerType: 'subtitle_compositor',
  providerProfileId: 'default'
});
if (!subtitleBlocked.providerAdapter.blockingReasons.includes('missing_required_output_target')) throw new Error('subtitle compositor should block without subtitle output');

const narrationBlocked = await createProviderAdapter({
  renderAdapterContractId: composite.renderAdapterContract.renderAdapterContractId,
  providerType: 'narration_pipeline',
  providerProfileId: 'default'
});
if (!narrationBlocked.providerAdapter.blockingReasons.includes('missing_required_output_target')) throw new Error('narration pipeline should block without narration plan output');

const storyboardContract = await createRenderAdapterContract({
  adapterType: 'storyboard_export',
  orchestrationProfile: 'dev',
  verifierPackageId: unified.verifierPackage.verifierPackageId,
  shotListId: shot.shotList.shotListId
});
if (storyboardContract.error) throw new Error(storyboardContract.error);

const storyboardProvider = await createProviderAdapter({
  renderAdapterContractId: storyboardContract.renderAdapterContract.renderAdapterContractId,
  providerType: 'storyboard_exporter',
  providerProfileId: 'default'
});
if (storyboardProvider.error) throw new Error(storyboardProvider.error);
if (!storyboardProvider.providerAdapter.providerManifest.outputTargetMap.every((o) => o.outputType === 'storyboard_json')) throw new Error('storyboard output map should only include storyboard_json');

const valid = await validateProviderAdapter({ providerAdapterId: genericProvider.providerAdapter.providerAdapterId });
if (valid.status !== 'valid') throw new Error('provider adapter validation should pass');

const invalid = await validateProviderAdapter({ providerManifest: { ...genericProvider.providerAdapter.providerManifest, executionJobs: [{ jobType: 'totally_unsupported' }] } });
if (!['capability_mismatch','malformed_provider_manifest'].includes(invalid.status)) throw new Error('invalid provider manifest should fail');

const exp = exportProviderAdapter(genericProvider.providerAdapter, 'markdown');
if (exp.error || !String(exp.content).includes('Provider Manifest')) throw new Error('markdown export invalid');

console.log('OK provider adapter fixtures');
