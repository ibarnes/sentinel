import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { createExternalVerifierProfile } from '../../verification/externalVerifierProfileService.js';
import { createRenderAdapterContract } from '../../production/renderAdapterContractService.js';
import { publishAdapterTrust } from '../../verification/adapterTrustPublicationService.js';
import { createAdmissionCertificate } from '../../verification/admissionCertificateService.js';
import { createOrchestrationProofCertificate, verifyProofCertificate, exportOrchestrationProofCertificate, latestOrchestrationProofCertificate } from '../../verification/orchestrationProofCertificateService.js';

const flowId = 'fixture_orchestration_proof_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Orchestration Proof Fixture',
  reviewVersion: 1,
  steps: [
    { id: 'p1', index: 1, title: 'Open', action: 'navigate', intent: 'open', screenshots: {}, annotations: [] },
    { id: 'p2', index: 2, title: 'Upload', action: 'upload', intent: 'upload', screenshots: {}, annotations: [] }
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
const external = await createExternalVerifierProfile({ verifierPackageId: unified.verifierPackage.verifierPackageId, policyProfileId: 'internal_verified', mode: 'explicit_refs' });
const adapter = await createRenderAdapterContract({ adapterType: 'composite_render', orchestrationProfile: 'internal_verified', verifierPackageId: unified.verifierPackage.verifierPackageId, shotListId: shot.shotList.shotListId, voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId });
await publishAdapterTrust(adapter.renderAdapterContract.renderAdapterContractId);
const admission = await createAdmissionCertificate({ renderAdapterContractId: adapter.renderAdapterContract.renderAdapterContractId, externalVerifierProfileId: external.externalVerifierProfile.externalVerifierProfileId, policyProfileId: 'internal_verified', mode: 'explicit_refs' });

const proof = await createOrchestrationProofCertificate({
  renderAdapterContractId: adapter.renderAdapterContract.renderAdapterContractId,
  externalVerifierProfileId: external.externalVerifierProfile.externalVerifierProfileId,
  admissionCertificateId: admission.admissionCertificate.admissionCertificateId,
  policyProfileId: 'internal_verified',
  mode: 'explicit_refs'
});
if (proof.error) throw new Error(proof.error);
if (!proof.orchestrationProofCertificate.proofDigest) throw new Error('missing proof digest');

const verifyOk = await verifyProofCertificate(proof.orchestrationProofCertificate);
if (!['verified','unsigned'].includes(verifyOk.status)) throw new Error(`unexpected verify status: ${verifyOk.status}`);

const tampered = { ...proof.orchestrationProofCertificate, startDecision: 'no_start' };
const verifyBad = await verifyProofCertificate(tampered);
if (verifyBad.status === 'verified') throw new Error('tampered proof should fail');

const latest = await latestOrchestrationProofCertificate({ renderAdapterContractId: adapter.renderAdapterContract.renderAdapterContractId, policyProfileId: 'internal_verified', mode: 'latest' });
if (latest.error || !latest.orchestrationProofCertificate.orchestrationProofCertificateId) throw new Error('latest proof unstable');

const exp = await exportOrchestrationProofCertificate(proof.orchestrationProofCertificate, 'signed_proof');
if (exp.error || !String(exp.content).includes('proofDigest')) throw new Error('signed_proof export invalid');

console.log('OK orchestration proof fixtures');
