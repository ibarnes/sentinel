import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createVoicePlanSnapshot } from '../../production/voicePlanSnapshotService.js';
import { publishVoiceTrust } from '../../production/voiceTrustPublicationService.js';
import { createUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { createExternalVerifierProfile, latestExternalVerifierProfile } from '../../verification/externalVerifierProfileService.js';
import { getPolicyManifest } from '../../verification/policyManifestService.js';
import { exportExternalVerifierProfile } from '../../verification/admissionControlExportService.js';
import { createAttestationSnapshot } from '../../verification/attestationSnapshotService.js';
import { publishAttestationTrust } from '../../verification/attestationTrustPublicationService.js';

const flowId = 'fixture_external_verifier_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'External Verifier Fixture',
  reviewVersion: 1,
  steps: [
    { id: 'e1', index: 1, title: 'Open', action: 'navigate', intent: 'open', screenshots: {}, annotations: [] },
    { id: 'e2', index: 2, title: 'Upload', action: 'upload', intent: 'upload', screenshots: {}, annotations: [] }
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
await createVoicePlanSnapshot(voice.voiceTrackPlan.voiceTrackPlanId, { createdBy: 'fixture' });
await publishVoiceTrust(voice.voiceTrackPlan.voiceTrackPlanId);

const unified = await createUnifiedVerifierPackage({
  scriptId: script.script.scriptId,
  shotListId: shot.shotList.shotListId,
  voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId,
  orchestrationPolicyProfile: 'internal_verified'
});
if (unified.error) throw new Error(unified.error);

// attestation chain/pubs for stricter profile checks
await createAttestationSnapshot(unified.verifierPackage.verifierPackageId, { createdBy: 'fixture' });
await publishAttestationTrust(unified.verifierPackage.verifierPackageId);

const extDev = await createExternalVerifierProfile({ verifierPackageId: unified.verifierPackage.verifierPackageId, policyProfileId: 'dev', mode: 'explicit_refs' });
if (extDev.error) throw new Error(extDev.error);
if (!['admit','admit_with_warnings','deny','missing_required_artifact','integrity_failed','signature_failed','policy_failed'].includes(extDev.externalVerifierProfile.overallVerdict)) {
  throw new Error('unexpected dev verdict');
}

const extInternal = await createExternalVerifierProfile({ verifierPackageId: unified.verifierPackage.verifierPackageId, policyProfileId: 'internal_verified', mode: 'explicit_refs' });
if (extInternal.error) throw new Error(extInternal.error);

const extProd = await createExternalVerifierProfile({ verifierPackageId: unified.verifierPackage.verifierPackageId, policyProfileId: 'production_verified', mode: 'explicit_refs' });
if (extProd.error) throw new Error(extProd.error);
if (!extProd.externalVerifierProfile.metadata?.policyEvaluationResult) throw new Error('missing production policy summary');

const latest = await latestExternalVerifierProfile({ policyProfileId: 'production_verified', mode: 'latest' });
if (latest.error || !latest.externalVerifierProfile.externalVerifierProfileId) throw new Error('latest endpoint unstable');

const policy = await getPolicyManifest('internal_verified');
if (policy.error || !policy.policyManifest.policyProfileId) throw new Error('policy manifest retrieval failed');

const verdictExport = exportExternalVerifierProfile(extInternal.externalVerifierProfile, 'compliance_verdict');
if (verdictExport.error) throw new Error('compliance verdict export failed');
const verdictObj = JSON.parse(verdictExport.content);
if (!verdictObj.verdictId || !verdictObj.policyProfile) throw new Error('compliance verdict structure invalid');

const md = exportExternalVerifierProfile(extInternal.externalVerifierProfile, 'markdown');
if (md.error || !String(md.content).includes('External Verifier Profile')) throw new Error('markdown export invalid');

console.log('OK external verifier fixtures');
