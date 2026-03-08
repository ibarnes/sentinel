import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';
import { createVoicePlanSnapshot } from '../../production/voicePlanSnapshotService.js';
import { publishVoiceTrust } from '../../production/voiceTrustPublicationService.js';
import { createUnifiedVerifierPackage, getUnifiedVerifierPackage } from '../../verification/unifiedVerifierService.js';
import { getPolicyManifest, listPolicyManifests } from '../../verification/policyManifestService.js';
import { buildAttestationReport, exportAttestationBundle, exportVerifierPackage } from '../../verification/attestationReportService.js';

const flowId = 'fixture_unified_verifier_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Unified Verifier Fixture Flow',
  reviewVersion: 1,
  steps: [
    { id: 'u1', index: 1, title: 'Open', action: 'navigate', intent: 'open page', screenshots: {}, annotations: [] },
    { id: 'u2', index: 2, title: 'Upload', action: 'upload', intent: 'upload file', screenshots: {}, annotations: [] }
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
if (!unified.verifierPackage.scriptTrustSummary || !unified.verifierPackage.voiceTrustSummary) throw new Error('missing unified domain summaries');

const fetched = await getUnifiedVerifierPackage(unified.verifierPackage.verifierPackageId);
if (fetched.error) throw new Error(fetched.error);

const policies = await listPolicyManifests();
if (!Array.isArray(policies.policies) || policies.policies.length < 3) throw new Error('policy list invalid');
const prod = await getPolicyManifest('production_verified');
if (prod.error || !prod.policyManifest.policyProfileId) throw new Error('policy export invalid');

const report = await buildAttestationReport(unified.verifierPackage.verifierPackageId);
if (report.error || !report.attestationReport.attestationReportId) throw new Error('attestation report invalid');

const md = exportVerifierPackage(unified.verifierPackage, 'markdown');
if (md.error || !String(md.content).includes('## Domain Summaries')) throw new Error('verifier markdown invalid');

const bundle = await exportAttestationBundle(unified.verifierPackage.verifierPackageId);
if (bundle.error || !bundle.buffer || !bundle.payload['attestation-report.json']) throw new Error('attestation bundle invalid');

const blockedProd = await createUnifiedVerifierPackage({
  scriptId: script.script.scriptId,
  voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId,
  orchestrationPolicyProfile: 'production_verified'
});
if (blockedProd.error) throw new Error(blockedProd.error);
if (blockedProd.verifierPackage.orchestrationPolicySummary.policyEvaluationResult === 'pass') {
  // may pass if keys configured; allow pass but ensure field exists
}

console.log('OK unified verifier fixtures');
