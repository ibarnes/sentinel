import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { createRenderAdapterContract } from '../../production/renderAdapterContractService.js';
import { createProviderAdapter } from '../../production/providerAdapterService.js';
import { createProviderSubmissionContract } from '../../production/providerSubmissionService.js';
import { createProviderExecutionAdapter, validateProviderExecutionAdapter, exportProviderExecutionAdapter } from '../../production/providerExecutionAdapterService.js';

const flowId = 'fixture_provider_exec_adapter_flow';
await writeJson(fileForReviewedFlow(flowId), { id: flowId, name: 'Provider Execution Adapter Fixture', reviewVersion: 1, steps: [
  { id: 'e1', index: 1, title: 'Start', action: 'navigate', intent: 'start', screenshots: {}, annotations: [] },
  { id: 'e2', index: 2, title: 'Next', action: 'click', intent: 'next', screenshots: {}, annotations: [] }
]});

const script = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
await initReviewedScript(script.script.scriptId, { actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'in_review', actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'approved', actor: 'fixture' });
await createReviewedSnapshot(script.script.scriptId, { actor: 'fixture' });

const shot = await createShotList({ scriptId: script.script.scriptId, publishReady: true });
const voice = await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true });
const unified = await createUnifiedVerifierPackage({ scriptId: script.script.scriptId, shotListId: shot.shotList.shotListId, voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId, orchestrationPolicyProfile: 'internal_verified' });

const narrated = await createRenderAdapterContract({ adapterType: 'narrated_walkthrough', orchestrationProfile: 'internal_verified', verifierPackageId: unified.verifierPackage.verifierPackageId, shotListId: shot.shotList.shotListId, voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId });
if (narrated.error) throw new Error(narrated.error);

const pa = await createProviderAdapter({ renderAdapterContractId: narrated.renderAdapterContract.renderAdapterContractId, providerType: 'generic_renderer', providerProfileId: 'default' });
if (pa.error) throw new Error(pa.error);
const sub = await createProviderSubmissionContract({ providerAdapterId: pa.providerAdapter.providerAdapterId, submissionMode: 'handoff_only' });
if (sub.error) throw new Error(sub.error);

const exGeneric = await createProviderExecutionAdapter({ providerSubmissionContractId: sub.providerSubmissionContract.providerSubmissionContractId, providerType: 'generic_renderer', providerProfileId: 'default', mode: 'explicit_refs' });
if (exGeneric.error) throw new Error(exGeneric.error);
if (!['ready','ready_with_warnings'].includes(exGeneric.providerExecutionAdapter.readinessState)) throw new Error('generic renderer expected ready-ish');

const exSubtitle = await createProviderExecutionAdapter({ providerSubmissionContractId: sub.providerSubmissionContract.providerSubmissionContractId, providerType: 'subtitle_compositor', providerProfileId: 'default', mode: 'explicit_refs' });
if (!['blocked','missing_required_input','unsupported_output_target'].includes(exSubtitle.providerExecutionAdapter.readinessState)) throw new Error('subtitle should block when missing');

const exNarr = await createProviderExecutionAdapter({ providerSubmissionContractId: sub.providerSubmissionContract.providerSubmissionContractId, providerType: 'narration_pipeline', providerProfileId: 'default', mode: 'explicit_refs' });
if (!['blocked','missing_required_input','unsupported_output_target','ready','ready_with_warnings'].includes(exNarr.providerExecutionAdapter.readinessState)) throw new Error('narration state unexpected');

const exScene = await createProviderExecutionAdapter({ providerSubmissionContractId: sub.providerSubmissionContract.providerSubmissionContractId, providerType: 'scene_compositor', providerProfileId: 'default', mode: 'explicit_refs' });
if (!['ready','ready_with_warnings','blocked','unsupported_stage_type','missing_required_input','unsupported_output_target'].includes(exScene.providerExecutionAdapter.readinessState)) throw new Error('scene compositor state unexpected');

const storyboardRac = await createRenderAdapterContract({ adapterType: 'storyboard_export', orchestrationProfile: 'dev', verifierPackageId: unified.verifierPackage.verifierPackageId, shotListId: shot.shotList.shotListId });
if (storyboardRac.error) throw new Error(storyboardRac.error);
const storyboardPa = await createProviderAdapter({ renderAdapterContractId: storyboardRac.renderAdapterContract.renderAdapterContractId, providerType: 'storyboard_exporter', providerProfileId: 'default' });
const storyboardSub = await createProviderSubmissionContract({ providerAdapterId: storyboardPa.providerAdapter.providerAdapterId, submissionMode: 'handoff_only' });
const exStoryboard = await createProviderExecutionAdapter({ providerSubmissionContractId: storyboardSub.providerSubmissionContract.providerSubmissionContractId, providerType: 'storyboard_exporter', providerProfileId: 'default', mode: 'explicit_refs' });
if (!exStoryboard.providerExecutionAdapter.providerExecutionPayload.outputTargetMap.every((o) => o.outputType === 'storyboard_json')) throw new Error('storyboard payload should be reduced');

const valid = await validateProviderExecutionAdapter({ providerExecutionAdapterId: exGeneric.providerExecutionAdapter.providerExecutionAdapterId });
if (!['valid','valid_with_warnings'].includes(valid.status)) throw new Error('expected valid payload');

const invalid = await validateProviderExecutionAdapter({ providerExecutionPayload: { ...exGeneric.providerExecutionAdapter.providerExecutionPayload, executionStages: [{ stageType: 'unknown_stage' }] } });
if (!['blocked','unsupported_stage_type','capability_mismatch'].includes(invalid.status)) throw new Error('invalid payload should fail');

const md = exportProviderExecutionAdapter(exGeneric.providerExecutionAdapter, 'markdown');
if (md.error || !String(md.content).includes('Provider Execution Adapter')) throw new Error('markdown export should work');

console.log('OK provider execution adapter fixtures');
