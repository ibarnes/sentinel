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
import { signAdapterManifest, signComplianceVerdict, verifyHandoffArtifact } from '../../verification/handoffCertificationService.js';
import { publishAdapterTrust } from '../../verification/adapterTrustPublicationService.js';
import { createAdmissionCertificate } from '../../verification/admissionCertificateService.js';
import { exportExternalVerifierProfile } from '../../verification/admissionControlExportService.js';

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

const c2 = await createRenderAdapterContract({
  adapterType: 'narrated_walkthrough',
  orchestrationProfile: 'dev',
  externalVerifierProfileId: external.externalVerifierProfile.externalVerifierProfileId,
  shotListId: shot.shotList.shotListId,
  voiceTrackPlanId: voice.voiceTrackPlan.voiceTrackPlanId,
  renderPlanId: 'rp_demo'
});
if (c2.error) throw new Error(`contract from external failed: ${c2.error}`);

const manifest = exportRenderAdapterContract(c1.renderAdapterContract, 'adapter_manifest');
if (manifest.error || !String(manifest.content).includes('executionPlan')) throw new Error('adapter manifest invalid');

const signedManifest = await signAdapterManifest(c1.renderAdapterContract);
if (!['signed','unsigned'].includes(signedManifest.adapterManifestSignatureStatus)) throw new Error('signed adapter manifest status missing');
const verifyManifest = await verifyHandoffArtifact('adapter_manifest', signedManifest);
if (!['verified','unsigned'].includes(verifyManifest.status)) throw new Error('adapter manifest verify unexpected');

const tamperedManifest = { ...signedManifest, adapterType: 'visual_only' };
const tamperedManifestRes = await verifyHandoffArtifact('adapter_manifest', tamperedManifest);
if (!['invalid_signature','unsigned'].includes(tamperedManifestRes.status)) throw new Error('tampered manifest should fail or be unsigned');

const verdictExp = exportExternalVerifierProfile(external.externalVerifierProfile, 'compliance_verdict');
const signedVerdict = await signComplianceVerdict(JSON.parse(verdictExp.content));
if (!['signed','unsigned'].includes(signedVerdict.complianceVerdictSignatureStatus)) throw new Error('signed compliance verdict status missing');
const verifyVerdict = await verifyHandoffArtifact('compliance_verdict', signedVerdict);
if (!['verified','unsigned'].includes(verifyVerdict.status)) throw new Error('compliance verdict verify unexpected');

const tamperedVerdict = { ...signedVerdict, overallVerdict: 'deny' };
const tamperedVerdictRes = await verifyHandoffArtifact('compliance_verdict', tamperedVerdict);
if (!['invalid_signature','unsigned'].includes(tamperedVerdictRes.status)) throw new Error('tampered verdict should fail or be unsigned');

const atp = await publishAdapterTrust(c1.renderAdapterContract.renderAdapterContractId);
if (atp.error) throw new Error(`adapter trust publication failed: ${atp.error}`);

const cert = await createAdmissionCertificate({
  renderAdapterContractId: c1.renderAdapterContract.renderAdapterContractId,
  externalVerifierProfileId: external.externalVerifierProfile.externalVerifierProfileId,
  policyProfileId: 'production_verified',
  mode: 'explicit_refs'
});
if (cert.error) throw new Error(`admission certificate failed: ${cert.error}`);
const verifyCert = await verifyHandoffArtifact('signed_certificate', cert.admissionCertificate);
if (!['verified','unsigned'].includes(verifyCert.status)) throw new Error('admission certificate verify unexpected');

const valid = validateAdapterContract(c1.renderAdapterContract);
if (!['valid','valid_with_warnings','blocked'].includes(valid.status)) throw new Error('unexpected validation status');

const invalid = validateAdapterContract({ adapterType: 'bad' });
if (invalid.status !== 'malformed_contract') throw new Error('expected malformed contract');

const md = exportRenderAdapterContract(c2.renderAdapterContract, 'markdown');
if (md.error || !String(md.content).includes('## Execution Plan')) throw new Error('markdown export invalid');

console.log('OK render adapter fixtures');
