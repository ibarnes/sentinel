import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import { createSession, appendEvents, closeSession } from '../services/ingestionService.js';
import { finalizeSessionToFlow } from '../services/normalizationService.js';
import { getFlow } from '../services/retrievalService.js';
import {
  initReviewedFlow,
  updateStep,
  reorderSteps,
  mergeSteps,
  deleteStep,
  addAnnotation,
  getReview,
  replaceReview
} from '../services/reviewedFlowService.js';
import { getFlowCompare } from '../services/compareService.js';
import { buildStepCoordinateReplay } from '../services/coordinateReplayService.js';
import { loadFromFlow, loadFromSnapshot, loadFromPackage } from '../player/flowPlayerService.js';
import { applyPlaybackControl } from '../player/playbackController.js';
import { safeAssetPath } from '../player/assetResolverService.js';
import { createPlayerSession, getPlayerSession, listPlayerSessions, patchPlayerSession, deletePlayerSession, resumePlayerSession, resolveSessionAssetPath } from '../player/playerSessionService.js';
import { sweepPlayerSessions, startPlayerSessionSweeper } from '../player/playerSessionSweeper.js';
import { normalizeEmbedConfig } from '../player/embedConfigService.js';
import { createShareLink, getShareLink, patchShareLink, deleteShareLink, resolveShareLink, listShareLinks } from '../player/shareLinkService.js';
import { integrityForStep, integrityRecomputeFlow } from '../services/replayIntegrityService.js';
import { createSnapshot, listSnapshots, getSnapshot, verifySnapshotIntegrity, recomputeFlowSnapshotIntegrity } from '../services/snapshotService.js';
import { exportReviewedFlow, exportSnapshot } from '../services/exportService.js';
import { buildReviewedPackage, buildSnapshotPackage, getReviewedPackageVerificationMetadata, getSnapshotPackageVerificationMetadata } from '../services/packageService.js';
import { getSigningContext, verifyVerificationMetadata, getVerificationKeyset, verifyKeysetIntegrity, TRUST_PROFILES } from '../services/packageSigningService.js';
import { createNarrationScript, getScript, getScriptExport, listStyleProfiles } from '../script/narrationScriptService.js';
import {
  initReviewedScript,
  getReviewedScript,
  updateReviewedSection,
  reorderReviewedSections,
  addReviewedSectionNote,
  replaceReviewedScript,
  updateReviewedStatus,
  reviewedExport
} from '../script/reviewedScriptService.js';
import { createReviewedSnapshot, listReviewedSnapshots, getReviewedSnapshot, verifyReviewedSnapshotIntegrity, recomputeReviewedSnapshotIntegrity } from '../script/reviewedScriptSnapshotService.js';
import { evaluatePublishGate } from '../script/scriptPublishGateService.js';
import { buildScriptAuditReport } from '../script/scriptAuditReportService.js';
import { publishTrust, listTrustPublications, getLatestTrustPublication, getTrustPublication } from '../script/reviewedSnapshotTrustPublicationService.js';
import { verifyLatestReviewedSnapshot } from '../script/reviewedSnapshotVerificationService.js';
import { buildProofBundle } from '../script/reviewedSnapshotProofBundleService.js';
import { createShotList, getShotList, exportShotList } from '../production/shotListService.js';
import { createEditIntent, listEditIntents, patchEditIntent, deleteEditIntent, applyEditIntentsToShotList, diffShotLists } from '../production/editIntentService.js';
import { createShotListSnapshot, listShotListSnapshots, getShotListSnapshot } from '../production/shotListSnapshotService.js';
import { buildAssemblyPackage } from '../production/assemblyPackageService.js';
import { createVoiceTrackPlan, getVoiceTrackPlan, exportVoiceTrackPlan } from '../production/voiceTrackPlanService.js';
import { createVoicePlanSnapshot, listVoicePlanSnapshots, getVoicePlanSnapshot } from '../production/voicePlanSnapshotService.js';
import { verifyVoicePlanSnapshotIntegrity, recomputeVoicePlanSnapshotIntegrity } from '../production/voicePlanIntegrityService.js';
import { buildSubtitleBundle, buildVoiceTrackAuditReport } from '../production/subtitleBundleService.js';
import { createRenderAdapterContract, getRenderAdapterContract, exportRenderAdapterContract } from '../production/renderAdapterContractService.js';
import { validateAdapterContract } from '../production/adapterValidationService.js';
import { createProviderAdapter, getProviderAdapter, exportProviderAdapter, validateProviderAdapter, listProviderCapabilityProfiles, inspectProviderCapabilityProfile } from '../production/providerAdapterService.js';
import { createProviderSubmissionContract, getProviderSubmissionContract, exportProviderSubmissionContract, listProviderSubmissionContracts, validateProviderSubmission } from '../production/providerSubmissionService.js';
import { createExecutionReceipt, getExecutionReceipt, patchExecutionReceipt, listExecutionReceipts, exportExecutionReceipt } from '../production/executionReceiptService.js';
import { createExecutionCallback, getExecutionCallback, listExecutionCallbacks, exportExecutionCallback, replayCheckExecutionCallback } from '../production/executionCallbackService.js';
import { verifyExecutionCallback } from '../production/callbackVerificationService.js';
import { listCallbackSigningKeys, listCallbackSigningKeysByProfile } from '../production/callbackKeyRegistryService.js';
import { listReplayLedger } from '../production/callbackReplayLedgerService.js';
import { publishSubmissionTrust, listSubmissionTrustPublications, getLatestSubmissionTrustPublication, getSubmissionTrustPublication } from '../production/submissionTrustPublicationService.js';
import { publishReceiptTrust, listReceiptTrustPublications, getLatestReceiptTrustPublication, getReceiptTrustPublication } from '../production/receiptTrustPublicationService.js';
import { createSchedulerBoard, getSchedulerBoard, latestSchedulerBoard, exportSchedulerBoard, verifySchedulerBoard } from '../production/schedulerBoardService.js';
import { createProviderExecutionAdapter, getProviderExecutionAdapter, exportProviderExecutionAdapter, validateProviderExecutionAdapter } from '../production/providerExecutionAdapterService.js';
import { publishVoiceTrust, listVoiceTrustPublications, getLatestVoiceTrustPublication, getVoiceTrustPublication } from '../production/voiceTrustPublicationService.js';
import { verifyLatestVoice } from '../production/voiceVerificationService.js';
import { buildSignedSubtitleBundle, verifySubtitleBundle } from '../production/subtitleProofService.js';
import { createUnifiedVerifierPackage, getUnifiedVerifierPackage, latestUnifiedVerifierPackage } from '../verification/unifiedVerifierService.js';
import { listPolicyManifests, getPolicyManifest } from '../verification/policyManifestService.js';
import { buildAttestationReport, exportAttestationBundle, exportVerifierPackage } from '../verification/attestationReportService.js';
import { createAttestationSnapshot, listAttestationSnapshots, getAttestationSnapshot } from '../verification/attestationSnapshotService.js';
import { publishAttestationTrust, listAttestationTrustPublications, getLatestAttestationTrustPublication, getAttestationTrustPublication } from '../verification/attestationTrustPublicationService.js';
import { verifyZipBundle } from '../verification/bundleVerificationService.js';
import { createExternalVerifierProfile, getExternalVerifierProfile, latestExternalVerifierProfile } from '../verification/externalVerifierProfileService.js';
import { exportExternalVerifierProfile } from '../verification/admissionControlExportService.js';
import { signAdapterManifest, signComplianceVerdict } from '../verification/handoffCertificationService.js';
import { createAdmissionCertificate, getAdmissionCertificate, exportAdmissionCertificate, latestAdmissionCertificate } from '../verification/admissionCertificateService.js';
import { publishAdapterTrust, listAdapterTrustPublications, getLatestAdapterTrustPublication, getAdapterTrustPublication } from '../verification/adapterTrustPublicationService.js';
import { verifyHandoff } from '../verification/handoffVerificationService.js';
import { createOrchestrationProofCertificate, getOrchestrationProofCertificate, exportOrchestrationProofCertificate, latestOrchestrationProofCertificate, verifyProofCertificate, buildSchedulerSafeProofVerdict } from '../verification/orchestrationProofCertificateService.js';
import { publishOrchestrationProofTrust, listOrchestrationProofTrustPublications, getLatestOrchestrationProofTrustPublication, getOrchestrationProofTrustPublication } from '../verification/orchestrationProofTrustPublicationService.js';
import { verifyDetachedProof } from '../verification/detachedProofVerificationService.js';

const router = express.Router();
const uploadPkg = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
startPlayerSessionSweeper();

router.get('/api/verification/keyset', async (_req, res) => {
  const out = await getVerificationKeyset();
  res.json(out);
});

router.get('/api/verification/keyset/integrity', async (_req, res) => {
  const keyset = await getVerificationKeyset();
  const out = await verifyKeysetIntegrity(keyset);
  res.json(out);
});

router.get('/api/verification/trust-profiles', async (_req, res) => {
  res.json({ trustProfiles: Object.values(TRUST_PROFILES) });
});

router.get('/api/player/flows/:flowId', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const current = Number(req.query.step || 0);
  const control = String(req.query.control || 'none');
  const jumpTo = req.query.jumpTo != null ? Number(req.query.jumpTo) : null;
  const loaded = await loadFromFlow(flowId);
  if (loaded.error) return res.status(404).json(loaded);
  const playback = applyPlaybackControl(loaded.model.steps.length, current, control, jumpTo);
  res.json({ model: loaded.model, playback });
});

router.get('/api/player/snapshots/:snapshotId', async (req, res) => {
  const snapshotId = String(req.params.snapshotId || '');
  const flowId = String(req.query.flowId || '');
  const current = Number(req.query.step || 0);
  const control = String(req.query.control || 'none');
  const jumpTo = req.query.jumpTo != null ? Number(req.query.jumpTo) : null;
  const loaded = await loadFromSnapshot(flowId || null, snapshotId);
  if (loaded.error) return res.status(404).json(loaded);
  const playback = applyPlaybackControl(loaded.model.steps.length, current, control, jumpTo);
  res.json({ model: loaded.model, playback });
});

router.post('/api/player/packages', uploadPkg.single('package'), async (req, res) => {
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'missing_package_file' });
  const tmp = `/tmp/revealpkg-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`;
  await fs.writeFile(tmp, req.file.buffer);
  const loaded = await loadFromPackage(tmp);
  await fs.rm(tmp, { force: true });
  if (loaded.error) return res.status(400).json(loaded);
  const playback = applyPlaybackControl(loaded.model.steps.length, 0, 'none', null);
  res.json({ model: loaded.model, playback });
});

router.get('/api/player/packages/:token/assets/:kind/:file', async (req, res) => {
  const token = String(req.params.token || '');
  const kind = String(req.params.kind || 'screenshots');
  const file = String(req.params.file || '');
  const stem = file.replace(/\.(jpg|jpeg|png)$/i, '');
  const m = stem.match(/^(.*)-(before|after|highlight)$/);
  if (!m) return res.status(400).json({ error: 'invalid_asset_name' });
  const stepId = m[1];
  const k = m[2];
  if (kind === 'highlights' && k !== 'highlight') return res.status(400).json({ error: 'asset_kind_mismatch' });
  if (kind === 'screenshots' && !['before','after'].includes(k)) return res.status(400).json({ error: 'asset_kind_mismatch' });
  const p = safeAssetPath(token, k, stepId);
  try {
    await fs.access(p);
    res.sendFile(p);
  } catch {
    res.status(404).json({ error: 'asset_not_found' });
  }
});

router.get('/api/player/sessions', async (req, res) => {
  const out = await listPlayerSessions({
    status: req.query.status ? String(req.query.status) : null,
    sourceType: req.query.sourceType ? String(req.query.sourceType) : null,
    flowId: req.query.flowId ? String(req.query.flowId) : null,
    snapshotId: req.query.snapshotId ? String(req.query.snapshotId) : null,
    includeExpired: req.query.includeExpired ? String(req.query.includeExpired) : '0',
    recoverable: req.query.recoverable ? String(req.query.recoverable) : '0',
    sourceRetentionPolicy: req.query.sourceRetentionPolicy ? String(req.query.sourceRetentionPolicy) : null
  });
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/player/sessions/sweep', async (_req, res) => {
  const out = await sweepPlayerSessions();
  res.json(out);
});

router.post('/api/player/sessions', uploadPkg.single('package'), async (req, res) => {
  const flowId = req.body?.flowId || null;
  const snapshotId = req.body?.snapshotId || null;
  const packageBuffer = req.file?.buffer || null;
  const viewerMetadata = req.body?.viewerMetadata ? (() => { try { return JSON.parse(req.body.viewerMetadata); } catch { return null; } })() : null;
  const sourceRetentionPolicy = req.body?.sourceRetentionPolicy || 'ephemeral_only';
  const packageOriginalFilename = req.file?.originalname || null;

  const out = await createPlayerSession({ flowId, snapshotId, packageBuffer, viewerMetadata, sourceRetentionPolicy, packageOriginalFilename });
  if (out.error) {
    const code = ['missing_source_input','conflicting_source_inputs'].includes(out.error) ? 400 : 404;
    return res.status(code).json(out);
  }
  res.status(201).json(out);
});

router.get('/api/player/sessions/:sessionId', async (req, res) => {
  const out = await getPlayerSession(String(req.params.sessionId || ''));
  if (out.error === 'session_not_found') return res.status(404).json(out);
  res.json(out);
});

router.patch('/api/player/sessions/:sessionId', async (req, res) => {
  const out = await patchPlayerSession(String(req.params.sessionId || ''), {
    action: req.body?.action || null,
    jumpTo: req.body?.jumpTo,
    autoPlayEnabled: req.body?.autoPlayEnabled ?? null
  });
  if (['session_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/player/sessions/:sessionId/resume', async (req, res) => {
  const out = await resumePlayerSession(String(req.params.sessionId || ''));
  if (out.error === 'session_not_found') return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.get('/api/scripts/style-profiles', async (_req, res) => {
  res.json({ styleProfiles: listStyleProfiles() });
});

router.post('/api/scripts', uploadPkg.single('package'), async (req, res) => {
  const flowId = req.body?.flowId || null;
  const snapshotId = req.body?.snapshotId || null;
  const sessionId = req.body?.sessionId || null;
  const styleProfile = req.body?.styleProfile || 'neutral_walkthrough';
  const createdBy = req.body?.createdBy || null;

  let packagePath = null;
  if (req.file?.buffer?.length) {
    packagePath = `/tmp/reveal-script-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`;
    await fs.writeFile(packagePath, req.file.buffer);
  }

  const out = await createNarrationScript({ flowId, snapshotId, sessionId, packagePath, styleProfile, createdBy });
  if (packagePath) await fs.rm(packagePath, { force: true });

  if (out.error === 'invalid_style_profile') return res.status(400).json(out);
  if (['missing_source_input','conflicting_source_inputs','missing_steps'].includes(out.error)) return res.status(400).json(out);
  if (['flow_not_found','snapshot_not_found','session_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['malformed_package','malformed_package_flow'].includes(out.error)) return res.status(400).json(out);
  if (out.error) return res.status(400).json(out);

  res.status(201).json({
    script: out.script,
    summary: {
      scriptId: out.script.scriptId,
      sourceType: out.script.sourceType,
      styleProfile: out.script.styleProfile,
      sectionCount: out.script.sections.length,
      totalEstimatedDurationMs: out.script.totalEstimatedDurationMs
    }
  });
});

router.get('/api/scripts/:scriptId', async (req, res) => {
  const out = await getScript(String(req.params.scriptId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/scripts/:scriptId/export', async (req, res) => {
  const out = await getScript(String(req.params.scriptId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const exp = getScriptExport(out.script, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/scripts/:scriptId/review/init', async (req, res) => {
  const out = await initReviewedScript(String(req.params.scriptId || ''), { actor: req.body?.actor || null });
  if (out.error === 'script_not_found') return res.status(404).json(out);
  res.status(201).json(out);
});

router.get('/api/scripts/:scriptId/review', async (req, res) => {
  const out = await getReviewedScript(String(req.params.scriptId || ''));
  if (out.error === 'script_not_found' || out.error === 'review_not_found') return res.status(404).json(out);
  res.json(out);
});

router.patch('/api/scripts/:scriptId/review/sections/:sectionId', async (req, res) => {
  const out = await updateReviewedSection(String(req.params.scriptId || ''), String(req.params.sectionId || ''), req.body || {}, req.body?.actor || null);
  if (['script_not_found', 'review_not_found', 'section_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['invalid_narration_text', 'invalid_timing'].includes(out.error)) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/scripts/:scriptId/review/sections/reorder', async (req, res) => {
  const out = await reorderReviewedSections(String(req.params.scriptId || ''), Array.isArray(req.body?.orderedSectionIds) ? req.body.orderedSectionIds : [], req.body?.actor || null);
  if (['script_not_found', 'review_not_found', 'section_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['invalid_reorder_payload', 'duplicate_reorder_ids'].includes(out.error)) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/scripts/:scriptId/review/sections/:sectionId/notes', async (req, res) => {
  const out = await addReviewedSectionNote(String(req.params.scriptId || ''), String(req.params.sectionId || ''), req.body?.note || '', req.body?.actor || null);
  if (['script_not_found', 'review_not_found', 'section_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error === 'invalid_note') return res.status(400).json(out);
  res.json(out);
});

router.put('/api/scripts/:scriptId/review', async (req, res) => {
  const out = await replaceReviewedScript(String(req.params.scriptId || ''), req.body || {}, req.body?.actor || null);
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error === 'invalid_review_payload') return res.status(400).json(out);
  res.json(out);
});

router.post('/api/scripts/:scriptId/review/status', async (req, res) => {
  const out = await updateReviewedStatus(String(req.params.scriptId || ''), {
    targetStatus: req.body?.targetStatus,
    reason: req.body?.reason || null,
    actor: req.body?.actor || null
  });
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error === 'invalid_status_transition') return res.status(400).json(out);
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/diff', async (req, res) => {
  const out = await getReviewedScript(String(req.params.scriptId || ''));
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  res.json({ diff: out.diff, reviewStatus: out.reviewed.reviewStatus, reviewVersion: out.reviewed.reviewVersion });
});

router.post('/api/scripts/:scriptId/review/snapshots', async (req, res) => {
  const out = await createReviewedSnapshot(String(req.params.scriptId || ''), { actor: req.body?.actor || null });
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error === 'snapshot_id_collision') return res.status(409).json(out);
  res.status(201).json(out);
});

router.get('/api/scripts/:scriptId/review/snapshots', async (req, res) => {
  const out = await listReviewedSnapshots(String(req.params.scriptId || ''));
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/snapshots/:reviewedSnapshotId', async (req, res) => {
  const out = await getReviewedSnapshot(String(req.params.scriptId || ''), String(req.params.reviewedSnapshotId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/snapshots/:reviewedSnapshotId/integrity', async (req, res) => {
  const out = await verifyReviewedSnapshotIntegrity(String(req.params.scriptId || ''), String(req.params.reviewedSnapshotId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/scripts/:scriptId/review/snapshots/integrity/recompute', async (req, res) => {
  const out = await recomputeReviewedSnapshotIntegrity(String(req.params.scriptId || ''));
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/audit-report', async (req, res) => {
  const requireIntegrity = String(req.query.requireLatestReviewedSnapshotIntegrity || process.env.REVEAL_REQUIRE_LATEST_REVIEWED_SNAPSHOT_INTEGRITY || '0') === '1';
  const out = await buildScriptAuditReport(String(req.params.scriptId || ''), { requireLatestReviewedSnapshotIntegrity: requireIntegrity });
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/scripts/:scriptId/review/trust-publications', async (req, res) => {
  const out = await publishTrust(String(req.params.scriptId || ''));
  if (out.error === 'no_reviewed_snapshot_for_publication') return res.status(400).json(out);
  if (out.error === 'trust_publication_id_collision') return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/scripts/:scriptId/review/trust-publications', async (req, res) => {
  const out = await listTrustPublications(String(req.params.scriptId || ''));
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/trust-publications/latest', async (req, res) => {
  const out = await getLatestTrustPublication(String(req.params.scriptId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/trust-publications/:trustPublicationId', async (req, res) => {
  const out = await getTrustPublication(String(req.params.scriptId || ''), String(req.params.trustPublicationId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/verify-latest', async (req, res) => {
  const out = await verifyLatestReviewedSnapshot(String(req.params.scriptId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/scripts/:scriptId/review/export-with-proof', async (req, res) => {
  const format = String(req.query.format || 'json').toLowerCase();
  const out = await buildProofBundle(String(req.params.scriptId || ''), { format });
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['latest_trust_publication_missing','invalid_proof_bundle_format'].includes(out.error)) return res.status(400).json(out);
  if (out.buffer) {
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.send(out.content);
});

router.post('/api/production/shot-lists', uploadPkg.single('package'), async (req, res) => {
  const scriptId = req.body?.scriptId || null;
  const flowId = req.body?.flowId || null;
  const snapshotId = req.body?.snapshotId || null;
  const sessionId = req.body?.sessionId || null;
  const styleProfile = req.body?.styleProfile || null;
  const publishReady = String(req.body?.publishReady || '0') === '1';
  const requireLatestReviewedSnapshotIntegrity = String(req.body?.requireLatestReviewedSnapshotIntegrity || '0') === '1';
  const requireLatestTrustPublication = String(req.body?.requireLatestTrustPublication || '0') === '1';

  let packagePath = null;
  if (req.file?.buffer?.length) {
    packagePath = `/tmp/reveal-shotlist-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`;
    await fs.writeFile(packagePath, req.file.buffer);
  }

  const out = await createShotList({ scriptId, flowId, snapshotId, sessionId, packagePath, styleProfile, publishReady, requireLatestReviewedSnapshotIntegrity, requireLatestTrustPublication });
  if (packagePath) await fs.rm(packagePath, { force: true });

  if (['missing_source_input','conflicting_source_inputs','empty_scene_generation'].includes(out.error)) return res.status(400).json(out);
  if (['script_not_found','review_not_found','flow_not_found','snapshot_not_found','session_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['publish_gate_blocked','latest_trust_publication_missing','latest_trust_publication_unsigned','chain_head_digest_missing'].includes(out.error)) return res.status(409).json(out);
  if (['malformed_package','malformed_package_flow','invalid_package_type'].includes(out.error)) return res.status(400).json(out);
  if (out.error) return res.status(400).json(out);

  res.status(201).json(out);
});

router.get('/api/production/shot-lists/:shotListId', async (req, res) => {
  const shotListId = String(req.params.shotListId || '');
  const out = await getShotList(shotListId);
  if (out.error) return res.status(404).json(out);
  const intents = await listEditIntents(shotListId);
  const effective = applyEditIntentsToShotList(out.shotList, intents.editIntents || []);
  const diff = diffShotLists(out.shotList, effective);
  const view = String(req.query.view || 'baseline');
  if (view === 'effective') return res.json({ shotList: effective });
  if (view === 'with_diff') return res.json({ baseline: out.shotList, editIntents: intents.editIntents || [], effective, diff });
  res.json(out);
});

router.post('/api/production/shot-lists/:shotListId/edit-intents', async (req, res) => {
  const out = await createEditIntent(String(req.params.shotListId || ''), req.body || {});
  if (['invalid_shot_id','invalid_edit_intent_type','invalid_duration_value','invalid_reorder_hint'].includes(out.error)) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/shot-lists/:shotListId/edit-intents', async (req, res) => {
  const out = await listEditIntents(String(req.params.shotListId || ''));
  res.json(out);
});

router.patch('/api/production/shot-lists/:shotListId/edit-intents/:editIntentId', async (req, res) => {
  const out = await patchEditIntent(String(req.params.shotListId || ''), String(req.params.editIntentId || ''), req.body || {});
  if (out.error === 'edit_intent_not_found') return res.status(404).json(out);
  if (['invalid_shot_id','invalid_edit_intent_type','invalid_duration_value','invalid_reorder_hint'].includes(out.error)) return res.status(400).json(out);
  res.json(out);
});

router.delete('/api/production/shot-lists/:shotListId/edit-intents/:editIntentId', async (req, res) => {
  const out = await deleteEditIntent(String(req.params.shotListId || ''), String(req.params.editIntentId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/shot-lists/:shotListId/snapshots', async (req, res) => {
  const out = await createShotListSnapshot(String(req.params.shotListId || ''), { createdBy: req.body?.createdBy || null });
  if (out.error === 'shot_list_not_found') return res.status(404).json(out);
  if (out.error === 'shot_list_snapshot_id_collision') return res.status(409).json(out);
  res.status(201).json(out);
});

router.get('/api/production/shot-lists/:shotListId/snapshots', async (req, res) => {
  const out = await listShotListSnapshots(String(req.params.shotListId || ''));
  res.json(out);
});

router.get('/api/production/shot-lists/:shotListId/snapshots/:shotListSnapshotId', async (req, res) => {
  const out = await getShotListSnapshot(String(req.params.shotListId || ''), String(req.params.shotListSnapshotId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/voice-tracks', uploadPkg.single('assemblyPackage'), async (req, res) => {
  const scriptId = req.body?.scriptId || null;
  const reviewedSnapshotId = req.body?.reviewedSnapshotId || null;
  const shotListId = req.body?.shotListId || null;
  const shotListSnapshotId = req.body?.shotListSnapshotId || null;
  const styleProfile = req.body?.styleProfile || null;
  const locale = req.body?.locale || 'en';
  const publishReady = String(req.body?.publishReady || '0') === '1';

  let assemblyPackageJson = null;
  if (req.file?.buffer?.length) {
    try { assemblyPackageJson = JSON.parse(req.file.buffer.toString('utf8')); }
    catch { return res.status(400).json({ error: 'malformed_assembly_input' }); }
  }

  const out = await createVoiceTrackPlan({ scriptId, reviewedSnapshotId, shotListId, shotListSnapshotId, assemblyPackageJson, styleProfile, locale, publishReady });
  if (['missing_source_input','conflicting_source_inputs','empty_narration_text'].includes(out.error)) return res.status(400).json(out);
  if (['script_not_found','review_not_found','snapshot_not_found','shot_list_not_found','shot_list_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error === 'script_not_approved') return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId', async (req, res) => {
  const out = await getVoiceTrackPlan(String(req.params.voiceTrackPlanId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/voice-tracks/:voiceTrackPlanId/snapshots', async (req, res) => {
  const out = await createVoicePlanSnapshot(String(req.params.voiceTrackPlanId || ''), { createdBy: req.body?.createdBy || null });
  if (out.error === 'voice_track_plan_not_found') return res.status(404).json(out);
  if (out.error === 'voice_plan_snapshot_id_collision') return res.status(409).json(out);
  res.status(201).json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/snapshots', async (req, res) => {
  const out = await listVoicePlanSnapshots(String(req.params.voiceTrackPlanId || ''));
  res.json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/snapshots/:voicePlanSnapshotId', async (req, res) => {
  const out = await getVoicePlanSnapshot(String(req.params.voiceTrackPlanId || ''), String(req.params.voicePlanSnapshotId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/snapshots/:voicePlanSnapshotId/integrity', async (req, res) => {
  const out = await verifyVoicePlanSnapshotIntegrity(String(req.params.voiceTrackPlanId || ''), String(req.params.voicePlanSnapshotId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/voice-tracks/:voiceTrackPlanId/snapshots/integrity/recompute', async (req, res) => {
  const out = await recomputeVoicePlanSnapshotIntegrity(String(req.params.voiceTrackPlanId || ''));
  res.json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/audit-report', async (req, res) => {
  const out = await buildVoiceTrackAuditReport(String(req.params.voiceTrackPlanId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/voice-tracks/:voiceTrackPlanId/trust-publications', async (req, res) => {
  const out = await publishVoiceTrust(String(req.params.voiceTrackPlanId || ''));
  if (out.error === 'no_voice_snapshot_for_publication') return res.status(400).json(out);
  if (out.error === 'voice_trust_publication_id_collision') return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/trust-publications', async (req, res) => {
  const out = await listVoiceTrustPublications(String(req.params.voiceTrackPlanId || ''));
  res.json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/trust-publications/latest', async (req, res) => {
  const out = await getLatestVoiceTrustPublication(String(req.params.voiceTrackPlanId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/trust-publications/:voiceTrustPublicationId', async (req, res) => {
  const out = await getVoiceTrustPublication(String(req.params.voiceTrackPlanId || ''), String(req.params.voiceTrustPublicationId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/verify-latest', async (req, res) => {
  const out = await verifyLatestVoice(String(req.params.voiceTrackPlanId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/voice-tracks/verify-bundle', uploadPkg.single('bundle'), async (req, res) => {
  let bundleObj = req.body?.bundle || null;
  if (req.file?.buffer?.length) {
    try { bundleObj = JSON.parse(req.file.buffer.toString('utf8')); }
    catch { return res.status(400).json({ status: 'malformed_bundle', reasonCodes: ['invalid_json_bundle'] }); }
  } else if (typeof bundleObj === 'string') {
    try { bundleObj = JSON.parse(bundleObj); }
    catch { return res.status(400).json({ status: 'malformed_bundle', reasonCodes: ['invalid_json_bundle'] }); }
  }
  const out = await verifySubtitleBundle(bundleObj);
  res.json(out);
});

router.post('/api/verification/unified', async (req, res) => {
  const out = await createUnifiedVerifierPackage({
    scriptId: req.body?.scriptId || null,
    reviewedSnapshotId: req.body?.reviewedSnapshotId || null,
    shotListId: req.body?.shotListId || null,
    shotListSnapshotId: req.body?.shotListSnapshotId || null,
    voiceTrackPlanId: req.body?.voiceTrackPlanId || null,
    voicePlanSnapshotId: req.body?.voicePlanSnapshotId || null,
    orchestrationPolicyProfile: req.body?.orchestrationPolicyProfile || 'dev'
  });
  if (out.error === 'unsupported_policy_profile') return res.status(400).json(out);
  if (out.error === 'missing_required_source_refs') return res.status(400).json(out);
  if (['review_not_found','script_not_found','voice_track_plan_not_found','shot_list_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/unified/:verifierPackageId', async (req, res) => {
  const out = await getUnifiedVerifierPackage(String(req.params.verifierPackageId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/unified/:verifierPackageId/export', async (req, res) => {
  const got = await getUnifiedVerifierPackage(String(req.params.verifierPackageId || ''));
  if (got.error) return res.status(404).json(got);
  const format = String(req.query.format || 'json').toLowerCase();
  if (format === 'attestation_bundle') {
    const out = await exportAttestationBundle(got.verifierPackage.verifierPackageId);
    if (out.error) return res.status(400).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }
  const exp = exportVerifierPackage(got.verifierPackage, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/verification/unified/:verifierPackageId/attestation-snapshots', async (req, res) => {
  const out = await createAttestationSnapshot(String(req.params.verifierPackageId || ''), { createdBy: req.body?.createdBy || null });
  if (out.error === 'verifier_package_not_found') return res.status(404).json(out);
  if (out.error === 'attestation_snapshot_id_collision') return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/unified/:verifierPackageId/attestation-snapshots', async (req, res) => {
  const out = await listAttestationSnapshots(String(req.params.verifierPackageId || ''));
  res.json(out);
});

router.get('/api/verification/unified/:verifierPackageId/attestation-snapshots/:attestationSnapshotId', async (req, res) => {
  const out = await getAttestationSnapshot(String(req.params.verifierPackageId || ''), String(req.params.attestationSnapshotId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/verification/unified/:verifierPackageId/attestation-trust-publications', async (req, res) => {
  const out = await publishAttestationTrust(String(req.params.verifierPackageId || ''));
  if (out.error === 'no_attestation_snapshot_for_publication') return res.status(400).json(out);
  if (out.error === 'attestation_trust_publication_id_collision') return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/unified/:verifierPackageId/attestation-trust-publications', async (req, res) => {
  const out = await listAttestationTrustPublications(String(req.params.verifierPackageId || ''));
  res.json(out);
});

router.get('/api/verification/unified/:verifierPackageId/attestation-trust-publications/latest', async (req, res) => {
  const out = await getLatestAttestationTrustPublication(String(req.params.verifierPackageId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/unified/:verifierPackageId/attestation-trust-publications/:attestationTrustPublicationId', async (req, res) => {
  const out = await getAttestationTrustPublication(String(req.params.verifierPackageId || ''), String(req.params.attestationTrustPublicationId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/verification/verify-zip-bundle', uploadPkg.single('bundle'), async (req, res) => {
  let buf = req.file?.buffer || null;
  if (!buf && typeof req.body?.bundle === 'string') {
    try { buf = Buffer.from(req.body.bundle, 'base64'); } catch {}
  }
  if (!buf?.length) return res.status(400).json({ status: 'malformed_bundle', reasonCodes: ['missing_bundle'] });
  const out = await verifyZipBundle(buf);
  res.json(out);
});

router.get('/api/verification/policies', async (_req, res) => {
  const out = await listPolicyManifests();
  res.json(out);
});

router.get('/api/verification/policies/:policyProfileId', async (req, res) => {
  const out = await getPolicyManifest(String(req.params.policyProfileId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/policies/:policyProfileId/export', async (req, res) => {
  const out = await getPolicyManifest(String(req.params.policyProfileId || ''));
  if (out.error) return res.status(404).json(out);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="policy-${out.policyManifest.policyProfileId}.json"`);
  res.send(JSON.stringify(out.policyManifest, null, 2));
});

router.get('/api/verification/latest', async (_req, res) => {
  const out = await latestUnifiedVerifierPackage();
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/verification/external', async (req, res) => {
  const out = await createExternalVerifierProfile({
    verifierPackageId: req.body?.verifierPackageId || null,
    scriptId: req.body?.scriptId || null,
    shotListId: req.body?.shotListId || null,
    voiceTrackPlanId: req.body?.voiceTrackPlanId || null,
    policyProfileId: req.body?.policyProfileId || 'dev',
    mode: req.body?.mode || 'latest'
  });
  if (['unsupported_policy_profile','invalid_mode','missing_required_source_refs'].includes(out.error)) return res.status(400).json(out);
  if (['verifier_package_not_found','script_not_found','review_not_found','voice_track_plan_not_found','shot_list_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/external/latest', async (req, res) => {
  const policyProfileId = req.query.policyProfileId ? String(req.query.policyProfileId) : 'dev';
  const verifierPackageId = req.query.verifierPackageId ? String(req.query.verifierPackageId) : null;
  const mode = req.query.mode ? String(req.query.mode) : 'latest';

  if (mode && !['latest','explicit_refs'].includes(mode)) return res.status(400).json({ error: 'invalid_mode' });
  const out = await latestExternalVerifierProfile({ policyProfileId, verifierPackageId, mode });
  if (['unsupported_policy_profile'].includes(out.error)) return res.status(400).json(out);
  if (['verifier_package_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/verification/admission-certificates', async (req, res) => {
  const out = await createAdmissionCertificate({
    renderAdapterContractId: req.body?.renderAdapterContractId || null,
    externalVerifierProfileId: req.body?.externalVerifierProfileId || null,
    policyProfileId: req.body?.policyProfileId || 'dev',
    mode: req.body?.mode || 'latest'
  });
  if (['render_adapter_contract_not_found','external_verifier_profile_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['unsupported_policy_profile','invalid_mode','missing_required_source_refs'].includes(out.error)) return res.status(400).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/admission-certificates/:admissionCertificateId', async (req, res) => {
  const out = await getAdmissionCertificate(String(req.params.admissionCertificateId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/admission-certificates/:admissionCertificateId/export', async (req, res) => {
  const out = await getAdmissionCertificate(String(req.params.admissionCertificateId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const exp = exportAdmissionCertificate(out.admissionCertificate, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.get('/api/verification/admission/latest', async (req, res) => {
  const out = await latestAdmissionCertificate({
    renderAdapterContractId: req.query.renderAdapterContractId ? String(req.query.renderAdapterContractId) : null,
    policyProfileId: req.query.policyProfileId ? String(req.query.policyProfileId) : 'dev',
    adapterType: req.query.adapterType ? String(req.query.adapterType) : null
  });
  if (['render_adapter_contract_not_found','external_verifier_profile_not_found','verifier_package_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['unsupported_policy_profile','invalid_mode'].includes(out.error)) return res.status(400).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/verification/verify-handoff', async (req, res) => {
  const out = await verifyHandoff({ artifactType: req.body?.artifactType || null, artifact: req.body?.artifact || null });
  res.json(out);
});

router.post('/api/verification/orchestration-proofs', async (req, res) => {
  const out = await createOrchestrationProofCertificate({
    renderAdapterContractId: req.body?.renderAdapterContractId || null,
    externalVerifierProfileId: req.body?.externalVerifierProfileId || null,
    admissionCertificateId: req.body?.admissionCertificateId || null,
    adapterTrustPublicationId: req.body?.adapterTrustPublicationId || null,
    attestationTrustPublicationId: req.body?.attestationTrustPublicationId || null,
    policyProfileId: req.body?.policyProfileId || 'dev',
    mode: req.body?.mode || 'latest'
  });
  if (['missing_required_refs_for_explicit_mode','unsupported_policy_profile','invalid_mode'].includes(out.error)) return res.status(400).json(out);
  if (['render_adapter_contract_not_found','external_verifier_profile_not_found','admission_certificate_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/orchestration-proofs/latest', async (req, res) => {
  const out = await latestOrchestrationProofCertificate({
    renderAdapterContractId: req.query.renderAdapterContractId ? String(req.query.renderAdapterContractId) : null,
    policyProfileId: req.query.policyProfileId ? String(req.query.policyProfileId) : 'dev',
    adapterType: req.query.adapterType ? String(req.query.adapterType) : null,
    mode: req.query.mode ? String(req.query.mode) : 'latest'
  });
  if (['render_adapter_contract_not_found','external_verifier_profile_not_found','admission_certificate_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['unsupported_policy_profile','invalid_mode','missing_required_refs_for_explicit_mode'].includes(out.error)) return res.status(400).json(out);
  if (out.error) return res.status(400).json(out);

  const proof = out.orchestrationProofCertificate;
  const trust = await getLatestOrchestrationProofTrustPublication(proof.orchestrationProofCertificateId);
  const verdict = buildSchedulerSafeProofVerdict(proof, null, trust.error ? null : trust.orchestrationProofTrustPublication.proofHeadDigest);

  res.json({
    orchestrationProofCertificate: proof,
    schedulerProof: {
      ...verdict,
      signatureStatus: proof.certificateSignatureStatus,
      linkedRefs: {
        orchestrationProofCertificateId: proof.orchestrationProofCertificateId,
        renderAdapterContractId: proof.renderAdapterContractId,
        adapterTrustPublicationId: proof.adapterTrustPublicationRef?.adapterTrustPublicationId || null,
        attestationTrustPublicationId: proof.attestationTrustPublicationRef?.attestationTrustPublicationId || null,
        admissionCertificateId: proof.admissionCertificateId,
        orchestrationProofTrustPublicationId: trust.error ? null : trust.orchestrationProofTrustPublication.orchestrationProofTrustPublicationId
      }
    }
  });
});

router.get('/api/verification/orchestration-proofs/:orchestrationProofCertificateId', async (req, res) => {
  const out = await getOrchestrationProofCertificate(String(req.params.orchestrationProofCertificateId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/orchestration-proofs/:orchestrationProofCertificateId/export', async (req, res) => {
  const out = await getOrchestrationProofCertificate(String(req.params.orchestrationProofCertificateId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const exp = await exportOrchestrationProofCertificate(out.orchestrationProofCertificate, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/verification/orchestration-proofs/:orchestrationProofCertificateId/trust-publications', async (req, res) => {
  const proofId = String(req.params.orchestrationProofCertificateId || '');
  const out = await publishOrchestrationProofTrust(proofId);
  if (['orchestration_proof_certificate_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['orchestration_proof_trust_publication_id_collision'].includes(out.error)) return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/verification/orchestration-proofs/:orchestrationProofCertificateId/trust-publications', async (req, res) => {
  const proofId = String(req.params.orchestrationProofCertificateId || '');
  const proof = await getOrchestrationProofCertificate(proofId);
  if (proof.error) return res.status(404).json(proof);
  const out = await listOrchestrationProofTrustPublications(proofId);
  res.json(out);
});

router.get('/api/verification/orchestration-proofs/:orchestrationProofCertificateId/trust-publications/latest', async (req, res) => {
  const proofId = String(req.params.orchestrationProofCertificateId || '');
  const proof = await getOrchestrationProofCertificate(proofId);
  if (proof.error) return res.status(404).json(proof);
  const out = await getLatestOrchestrationProofTrustPublication(proofId);
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/orchestration-proofs/:orchestrationProofCertificateId/trust-publications/:orchestrationProofTrustPublicationId', async (req, res) => {
  const proofId = String(req.params.orchestrationProofCertificateId || '');
  const pubId = String(req.params.orchestrationProofTrustPublicationId || '');
  const out = await getOrchestrationProofTrustPublication(proofId, pubId);
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/verification/verify-proof', async (req, res) => {
  const out = await verifyProofCertificate(req.body?.orchestrationProofCertificateId ? { orchestrationProofCertificateId: req.body.orchestrationProofCertificateId } : (req.body?.proof || req.body));
  if (['orchestration_proof_certificate_not_found'].includes(out.error)) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/verification/verify-detached-proof', async (req, res) => {
  const out = await verifyDetachedProof({
    payload: req.body?.payload || null,
    signature: req.body?.signature || null,
    trust: req.body?.trust || null
  });
  res.json(out);
});

router.get('/api/verification/external/:externalVerifierProfileId', async (req, res) => {
  const out = await getExternalVerifierProfile(String(req.params.externalVerifierProfileId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/verification/external/:externalVerifierProfileId/export', async (req, res) => {
  const out = await getExternalVerifierProfile(String(req.params.externalVerifierProfileId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'compliance_verdict') {
    const exp = exportExternalVerifierProfile(out.externalVerifierProfile, format);
    if (exp.error) return res.status(400).json(exp);
    const signed = await signComplianceVerdict(JSON.parse(exp.content));
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${out.externalVerifierProfile.externalVerifierProfileId}-compliance-verdict.json"`);
    return res.send(JSON.stringify(signed, null, 2));
  }

  const exp = exportExternalVerifierProfile(out.externalVerifierProfile, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/export', async (req, res) => {
  const voiceTrackPlanId = String(req.params.voiceTrackPlanId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'subtitle_bundle') {
    const out = await buildSubtitleBundle({
      voiceTrackPlanId,
      voicePlanSnapshotId: req.query.voicePlanSnapshotId ? String(req.query.voicePlanSnapshotId) : null,
      format,
      requireLatestVoicePlanSnapshotIntegrity: String(req.query.requireLatestVoicePlanSnapshotIntegrity || '0') === '1',
      requireLatestTrustPublication: String(req.query.requireLatestTrustPublication || '0') === '1'
    });
    if (['voice_track_plan_not_found','voice_plan_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
    if (['subtitle_bundle_policy_blocked','invalid_subtitle_bundle_format'].includes(out.error)) return res.status(409).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }

  if (format === 'signed_subtitle_bundle') {
    const out = await buildSignedSubtitleBundle({
      voiceTrackPlanId,
      voicePlanSnapshotId: req.query.voicePlanSnapshotId ? String(req.query.voicePlanSnapshotId) : null,
      format,
      orchestrationPolicyProfile: String(req.query.orchestrationPolicyProfile || 'dev')
    });
    if (['voice_track_plan_not_found','voice_plan_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
    if (['subtitle_bundle_policy_blocked','invalid_signed_subtitle_bundle_format'].includes(out.error)) return res.status(409).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }

  const out = await getVoiceTrackPlan(voiceTrackPlanId);
  if (out.error) return res.status(404).json(out);
  const exp = exportVoiceTrackPlan(out.voiceTrackPlan, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.get('/api/production/voice-tracks/:voiceTrackPlanId/snapshots/:voicePlanSnapshotId/export', async (req, res) => {
  const voiceTrackPlanId = String(req.params.voiceTrackPlanId || '');
  const voicePlanSnapshotId = String(req.params.voicePlanSnapshotId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'subtitle_bundle') {
    const out = await buildSubtitleBundle({
      voiceTrackPlanId,
      voicePlanSnapshotId,
      format,
      requireLatestVoicePlanSnapshotIntegrity: String(req.query.requireLatestVoicePlanSnapshotIntegrity || '0') === '1',
      requireLatestTrustPublication: String(req.query.requireLatestTrustPublication || '0') === '1'
    });
    if (['voice_track_plan_not_found','voice_plan_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
    if (['subtitle_bundle_policy_blocked','invalid_subtitle_bundle_format'].includes(out.error)) return res.status(409).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }

  if (format === 'signed_subtitle_bundle') {
    const out = await buildSignedSubtitleBundle({
      voiceTrackPlanId,
      voicePlanSnapshotId,
      format,
      orchestrationPolicyProfile: String(req.query.orchestrationPolicyProfile || 'dev')
    });
    if (['voice_track_plan_not_found','voice_plan_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
    if (['subtitle_bundle_policy_blocked','invalid_signed_subtitle_bundle_format'].includes(out.error)) return res.status(409).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }

  const out = await getVoicePlanSnapshot(voiceTrackPlanId, voicePlanSnapshotId);
  if (out.error) return res.status(404).json(out);
  const exp = exportVoiceTrackPlan(out.snapshot.frozenVoiceTrackPlan, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/render-adapters', async (req, res) => {
  const out = await createRenderAdapterContract({
    adapterType: req.body?.adapterType || null,
    orchestrationProfile: req.body?.orchestrationProfile || 'dev',
    verifierPackageId: req.body?.verifierPackageId || null,
    externalVerifierProfileId: req.body?.externalVerifierProfileId || null,
    renderPlanId: req.body?.renderPlanId || null,
    shotListId: req.body?.shotListId || null,
    shotListSnapshotId: req.body?.shotListSnapshotId || null,
    voiceTrackPlanId: req.body?.voiceTrackPlanId || null
  });
  if (['missing_adapter_type','unsupported_adapter_type','conflicting_source_refs','missing_trusted_upstream_refs'].includes(out.error)) return res.status(400).json(out);
  if (['verifier_package_not_found','external_verifier_profile_not_found','shot_list_not_found','shot_list_snapshot_not_found','voice_track_plan_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['malformed_contract','missing_required_artifact'].includes(out.error)) return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/render-adapters/:renderAdapterContractId', async (req, res) => {
  const out = await getRenderAdapterContract(String(req.params.renderAdapterContractId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/render-adapters/:renderAdapterContractId/export', async (req, res) => {
  const out = await getRenderAdapterContract(String(req.params.renderAdapterContractId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'adapter_manifest') {
    const signed = await signAdapterManifest(out.renderAdapterContract);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${signed.renderAdapterContractId}.manifest.json"`);
    return res.send(JSON.stringify(signed, null, 2));
  }

  const exp = exportRenderAdapterContract(out.renderAdapterContract, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/render-adapters/validate', async (req, res) => {
  let contract = req.body?.contract || null;
  if (!contract && req.body?.renderAdapterContractId) {
    const got = await getRenderAdapterContract(String(req.body.renderAdapterContractId));
    if (got.error) return res.status(404).json(got);
    contract = got.renderAdapterContract;
  }
  const out = validateAdapterContract(contract);
  res.json(out);
});

router.post('/api/production/render-adapters/:renderAdapterContractId/trust-publications', async (req, res) => {
  const out = await publishAdapterTrust(String(req.params.renderAdapterContractId || ''));
  if (out.error === 'render_adapter_contract_not_found') return res.status(404).json(out);
  if (out.error === 'adapter_trust_publication_id_collision') return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/render-adapters/:renderAdapterContractId/trust-publications', async (req, res) => {
  const out = await listAdapterTrustPublications(String(req.params.renderAdapterContractId || ''));
  res.json(out);
});

router.get('/api/production/render-adapters/:renderAdapterContractId/trust-publications/latest', async (req, res) => {
  const out = await getLatestAdapterTrustPublication(String(req.params.renderAdapterContractId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/render-adapters/:renderAdapterContractId/trust-publications/:adapterTrustPublicationId', async (req, res) => {
  const out = await getAdapterTrustPublication(String(req.params.renderAdapterContractId || ''), String(req.params.adapterTrustPublicationId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/provider-adapters', async (req, res) => {
  const out = await createProviderAdapter({
    renderAdapterContractId: req.body?.renderAdapterContractId || null,
    providerType: req.body?.providerType || null,
    providerProfileId: req.body?.providerProfileId || 'default',
    orchestrationProfile: req.body?.orchestrationProfile || null
  });
  if (['missing_render_adapter_contract_id','missing_provider_type','unsupported_provider_profile'].includes(out.error)) return res.status(400).json(out);
  if (['render_adapter_contract_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/provider-adapters/:providerAdapterId', async (req, res) => {
  const out = await getProviderAdapter(String(req.params.providerAdapterId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/provider-adapters/:providerAdapterId/export', async (req, res) => {
  const out = await getProviderAdapter(String(req.params.providerAdapterId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const exp = exportProviderAdapter(out.providerAdapter, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/provider-adapters/validate', async (req, res) => {
  const out = await validateProviderAdapter({
    providerAdapterId: req.body?.providerAdapterId || null,
    providerManifest: req.body?.providerManifest || req.body?.manifest || null
  });
  if (out.error === 'provider_adapter_not_found') return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/provider-profiles', async (_req, res) => {
  res.json(listProviderCapabilityProfiles());
});

router.get('/api/production/provider-profiles/:providerType/:providerProfileId', async (req, res) => {
  const out = inspectProviderCapabilityProfile(String(req.params.providerType || ''), String(req.params.providerProfileId || 'default'));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/provider-execution-adapters', async (req, res) => {
  const out = await createProviderExecutionAdapter({
    providerSubmissionContractId: req.body?.providerSubmissionContractId || null,
    providerType: req.body?.providerType || null,
    providerProfileId: req.body?.providerProfileId || 'default',
    policyProfileId: req.body?.policyProfileId || null,
    mode: req.body?.mode || 'latest'
  });
  if (['missing_provider_submission_contract_id','unsupported_provider_profile'].includes(out.error)) return res.status(400).json(out);
  if (['provider_submission_contract_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/provider-execution-adapters/:providerExecutionAdapterId', async (req, res) => {
  const out = await getProviderExecutionAdapter(String(req.params.providerExecutionAdapterId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/provider-execution-adapters/:providerExecutionAdapterId/export', async (req, res) => {
  const out = await getProviderExecutionAdapter(String(req.params.providerExecutionAdapterId || ''));
  if (out.error) return res.status(404).json(out);
  const exp = exportProviderExecutionAdapter(out.providerExecutionAdapter, String(req.query.format || 'json').toLowerCase());
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/provider-execution-adapters/validate', async (req, res) => {
  const out = await validateProviderExecutionAdapter({
    providerExecutionAdapterId: req.body?.providerExecutionAdapterId || null,
    providerExecutionPayload: req.body?.providerExecutionPayload || req.body?.payload || null
  });
  if (out.error === 'provider_execution_adapter_not_found') return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/provider-submissions', async (req, res) => {
  const out = await createProviderSubmissionContract({
    providerAdapterId: req.body?.providerAdapterId || null,
    submissionMode: req.body?.submissionMode || 'dry_run',
    policyProfile: req.body?.policyProfile || null,
    requestSummary: req.body?.requestSummary || null
  });
  if (['missing_provider_adapter_id','unsupported_submission_mode'].includes(out.error)) return res.status(400).json(out);
  if (['provider_adapter_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/provider-submissions', async (req, res) => {
  const out = await listProviderSubmissionContracts({
    providerType: req.query.providerType ? String(req.query.providerType) : null,
    providerProfileId: req.query.providerProfileId ? String(req.query.providerProfileId) : null,
    readinessState: req.query.readinessState ? String(req.query.readinessState) : null,
    createdAfter: req.query.createdAfter ? String(req.query.createdAfter) : null
  });
  res.json(out);
});

router.get('/api/production/provider-submissions/:providerSubmissionContractId', async (req, res) => {
  const out = await getProviderSubmissionContract(String(req.params.providerSubmissionContractId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/provider-submissions/:providerSubmissionContractId/export', async (req, res) => {
  const out = await getProviderSubmissionContract(String(req.params.providerSubmissionContractId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const exp = exportProviderSubmissionContract(out.providerSubmissionContract, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/provider-submissions/validate', async (req, res) => {
  const out = await validateProviderSubmission({
    providerSubmissionContractId: req.body?.providerSubmissionContractId || null,
    submissionPayload: req.body?.submissionPayload || req.body?.payload || null,
    policyProfile: req.body?.policyProfile || null
  });
  if (out.error === 'provider_submission_contract_not_found') return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/provider-submissions/:providerSubmissionContractId/trust-publications', async (req, res) => {
  const out = await publishSubmissionTrust(String(req.params.providerSubmissionContractId || ''));
  if (['provider_submission_contract_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['submission_trust_publication_id_collision'].includes(out.error)) return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/provider-submissions/:providerSubmissionContractId/trust-publications', async (req, res) => {
  const out = await listSubmissionTrustPublications(String(req.params.providerSubmissionContractId || ''));
  res.json(out);
});

router.get('/api/production/provider-submissions/:providerSubmissionContractId/trust-publications/latest', async (req, res) => {
  const out = await getLatestSubmissionTrustPublication(String(req.params.providerSubmissionContractId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/provider-submissions/:providerSubmissionContractId/trust-publications/:submissionTrustPublicationId', async (req, res) => {
  const out = await getSubmissionTrustPublication(String(req.params.providerSubmissionContractId || ''), String(req.params.submissionTrustPublicationId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/execution-receipts', async (req, res) => {
  const out = await createExecutionReceipt({
    providerSubmissionContractId: req.body?.providerSubmissionContractId || null,
    requestSummary: req.body?.requestSummary || null
  });
  if (out.error === 'missing_provider_submission_contract_id') return res.status(400).json(out);
  if (out.error === 'provider_submission_contract_not_found') return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/execution-receipts', async (req, res) => {
  const out = await listExecutionReceipts({
    providerType: req.query.providerType ? String(req.query.providerType) : null,
    submissionStatus: req.query.submissionStatus ? String(req.query.submissionStatus) : null,
    schedulerStatus: req.query.schedulerStatus ? String(req.query.schedulerStatus) : null,
    providerProfileId: req.query.providerProfileId ? String(req.query.providerProfileId) : null,
    createdAfter: req.query.createdAfter ? String(req.query.createdAfter) : null
  });
  res.json(out);
});

router.get('/api/production/execution-receipts/:executionReceiptId', async (req, res) => {
  const out = await getExecutionReceipt(String(req.params.executionReceiptId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.patch('/api/production/execution-receipts/:executionReceiptId', async (req, res) => {
  const out = await patchExecutionReceipt(String(req.params.executionReceiptId || ''), req.body || {});
  if (out.error === 'execution_receipt_not_found') return res.status(404).json(out);
  if (['malformed_lifecycle_patch','illegal_status_transition'].includes(out.error)) return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.get('/api/production/execution-receipts/:executionReceiptId/export', async (req, res) => {
  const out = await getExecutionReceipt(String(req.params.executionReceiptId || ''));
  if (out.error) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const exp = exportExecutionReceipt(out.executionReceipt, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/execution-receipts/:executionReceiptId/trust-publications', async (req, res) => {
  const out = await publishReceiptTrust(String(req.params.executionReceiptId || ''));
  if (['execution_receipt_not_found'].includes(out.error)) return res.status(404).json(out);
  if (['receipt_trust_publication_id_collision'].includes(out.error)) return res.status(409).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.post('/api/production/execution-callbacks/verify', async (req, res) => {
  const out = await verifyExecutionCallback({
    providerType: req.body?.providerType || null,
    providerProfileId: req.body?.providerProfileId || 'default',
    callbackType: req.body?.callbackType || null,
    callbackPayload: req.body?.callbackPayload || null,
    trustMetadata: req.body?.trustMetadata || {},
    callbackDigest: req.body?.callbackDigest || null,
    callbackPolicyProfile: req.body?.callbackPolicyProfile || 'dev'
  });
  res.json(out);
});

router.post('/api/production/execution-callbacks', async (req, res) => {
  const out = await createExecutionCallback(req.body || {});
  if (['missing_provider_profile','unsupported_callback_type','malformed_callback_payload'].includes(out.error)) return res.status(400).json(out);
  if (out.executionCallback?.reconciliationStatus === 'malformed_callback') return res.status(400).json(out);
  res.status(201).json(out);
});

router.post('/api/production/execution-callbacks/replay-check', async (req, res) => {
  const out = await replayCheckExecutionCallback(req.body || {});
  res.json(out);
});

router.get('/api/production/callback-keys', async (_req, res) => {
  const out = await listCallbackSigningKeys();
  res.json(out);
});

router.get('/api/production/callback-keys/:providerType/:providerProfileId', async (req, res) => {
  const out = await listCallbackSigningKeysByProfile(String(req.params.providerType || ''), String(req.params.providerProfileId || 'default'));
  res.json(out);
});

router.get('/api/production/execution-callbacks/replay-ledger', async (_req, res) => {
  const out = await listReplayLedger();
  res.json(out);
});

router.get('/api/production/execution-callbacks', async (_req, res) => {
  const out = await listExecutionCallbacks();
  res.json(out);
});

router.get('/api/production/execution-callbacks/:executionCallbackId', async (req, res) => {
  const out = await getExecutionCallback(String(req.params.executionCallbackId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/execution-callbacks/:executionCallbackId/export', async (req, res) => {
  const out = await getExecutionCallback(String(req.params.executionCallbackId || ''));
  if (out.error) return res.status(404).json(out);
  const exp = exportExecutionCallback(out.executionCallback, String(req.query.format || 'json').toLowerCase());
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.get('/api/production/execution-receipts/:executionReceiptId/trust-publications', async (req, res) => {
  const out = await listReceiptTrustPublications(String(req.params.executionReceiptId || ''));
  res.json(out);
});

router.get('/api/production/execution-receipts/:executionReceiptId/trust-publications/latest', async (req, res) => {
  const out = await getLatestReceiptTrustPublication(String(req.params.executionReceiptId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/execution-receipts/:executionReceiptId/trust-publications/:receiptTrustPublicationId', async (req, res) => {
  const out = await getReceiptTrustPublication(String(req.params.executionReceiptId || ''), String(req.params.receiptTrustPublicationId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/production/scheduler-board', async (req, res) => {
  const out = await createSchedulerBoard({
    renderAdapterContractId: req.body?.renderAdapterContractId || null,
    providerSubmissionContractId: req.body?.providerSubmissionContractId || null,
    executionReceiptId: req.body?.executionReceiptId || null,
    orchestrationProofCertificateId: req.body?.orchestrationProofCertificateId || null,
    policyProfileId: req.body?.policyProfileId || 'dev',
    mode: req.body?.mode || 'latest'
  });
  if (['missing_required_refs_for_explicit_mode'].includes(out.error)) return res.status(400).json(out);
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/production/scheduler-board/latest', async (req, res) => {
  const out = await latestSchedulerBoard({
    renderAdapterContractId: req.query.renderAdapterContractId ? String(req.query.renderAdapterContractId) : null,
    policyProfileId: req.query.policyProfileId ? String(req.query.policyProfileId) : 'dev',
    mode: req.query.mode ? String(req.query.mode) : 'latest'
  });
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.get('/api/production/scheduler-board/:schedulerBoardId', async (req, res) => {
  const out = await getSchedulerBoard(String(req.params.schedulerBoardId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/scheduler-board/:schedulerBoardId/export', async (req, res) => {
  const out = await getSchedulerBoard(String(req.params.schedulerBoardId || ''));
  if (out.error) return res.status(404).json(out);
  const exp = exportSchedulerBoard(out.schedulerBoard, String(req.query.format || 'json').toLowerCase());
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.post('/api/production/verify-scheduler-board', async (req, res) => {
  const out = await verifySchedulerBoard(req.body?.schedulerBoardId ? { schedulerBoardId: req.body.schedulerBoardId } : (req.body?.schedulerBoard || req.body));
  if (out.error === 'scheduler_board_not_found') return res.status(404).json(out);
  res.json(out);
});

router.get('/api/production/shot-lists/:shotListId/snapshots/:shotListSnapshotId/export', async (req, res) => {
  const shotListId = String(req.params.shotListId || '');
  const shotListSnapshotId = String(req.params.shotListSnapshotId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'assembly_package') {
    const out = await buildAssemblyPackage({ shotListId, shotListSnapshotId, format, requireLatestTrustPublication: String(req.query.requireLatestTrustPublication || '0') === '1' });
    if (['shot_list_not_found','shot_list_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
    if (['latest_trust_publication_missing','invalid_assembly_export_format'].includes(out.error)) return res.status(409).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }

  const out = await getShotListSnapshot(shotListId, shotListSnapshotId);
  if (out.error) return res.status(404).json(out);
  const exp = exportShotList(out.snapshot.frozenShotList, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.get('/api/production/shot-lists/:shotListId/export', async (req, res) => {
  const shotListId = String(req.params.shotListId || '');
  const shotListSnapshotId = req.query.shotListSnapshotId ? String(req.query.shotListSnapshotId) : null;
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'assembly_package') {
    const out = await buildAssemblyPackage({
      shotListId,
      shotListSnapshotId,
      format,
      requireLatestTrustPublication: String(req.query.requireLatestTrustPublication || '0') === '1'
    });
    if (['shot_list_not_found','shot_list_snapshot_not_found'].includes(out.error)) return res.status(404).json(out);
    if (['latest_trust_publication_missing','invalid_assembly_export_format'].includes(out.error)) return res.status(409).json(out);
    res.setHeader('Content-Type', out.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
    return res.send(out.buffer);
  }

  const out = shotListSnapshotId ? await getShotListSnapshot(shotListId, shotListSnapshotId) : await getShotList(shotListId);
  if (out.error) return res.status(404).json(out);
  const shotList = shotListSnapshotId ? out.snapshot.frozenShotList : out.shotList;
  const exp = exportShotList(shotList, format);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.get('/api/scripts/:scriptId/review/export', async (req, res) => {
  const out = await getReviewedScript(String(req.params.scriptId || ''));
  if (['script_not_found', 'review_not_found'].includes(out.error)) return res.status(404).json(out);
  const format = String(req.query.format || 'json').toLowerCase();
  const includeNotes = String(req.query.includeNotes || '1') === '1';
  const mode = String(req.query.mode || 'standard');
  if (!['standard', 'publish_ready'].includes(mode)) return res.status(400).json({ error: 'invalid_export_mode' });

  const requireIntegrity = String(req.query.requireLatestReviewedSnapshotIntegrity || process.env.REVEAL_REQUIRE_LATEST_REVIEWED_SNAPSHOT_INTEGRITY || '0') === '1';
  const requireTrustPublication = String(req.query.requireLatestTrustPublication || process.env.REVEAL_REQUIRE_LATEST_TRUST_PUBLICATION || '0') === '1';

  const latestList = await listReviewedSnapshots(String(req.params.scriptId || ''));
  const latestSnapshot = (latestList.snapshots || []).length ? [...latestList.snapshots].sort((a, b) => Number(b.reviewedSnapshotChainIndex || 0) - Number(a.reviewedSnapshotChainIndex || 0))[0] : null;
  const latestIntegrity = latestSnapshot ? await verifyReviewedSnapshotIntegrity(String(req.params.scriptId || ''), latestSnapshot.reviewedSnapshotId) : null;

  const latestTrust = await getLatestTrustPublication(String(req.params.scriptId || ''));
  const trustMissing = !!latestTrust.error;
  const trustUnsigned = !trustMissing && latestTrust.trustPublication.trustPublicationSignatureStatus !== 'signed';
  const trustInvalid = false;

  const gate = evaluatePublishGate({
    baseline: out.baseline,
    reviewed: out.reviewed,
    requireLatestReviewedSnapshotIntegrity: requireIntegrity,
    latestReviewedSnapshotIntegrity: latestIntegrity && !latestIntegrity.error ? latestIntegrity : null
  });
  if (requireTrustPublication) {
    if (trustMissing) gate.blockingReasons.push('latest_trust_publication_missing');
    else {
      if (!latestTrust.trustPublication.chainHeadDigest) gate.blockingReasons.push('chain_head_digest_missing');
      if (trustUnsigned) gate.blockingReasons.push('latest_trust_publication_unsigned');
      if (trustInvalid) gate.blockingReasons.push('latest_trust_publication_invalid');
    }
    gate.canPublish = gate.blockingReasons.length === 0;
  }
  if (mode === 'publish_ready' && !gate.canPublish) {
    return res.status(409).json({ error: 'publish_gate_blocked', publishGate: gate, latestReviewedSnapshotIntegrity: latestIntegrity || null });
  }

  const exp = reviewedExport(out, format, includeNotes);
  if (exp.error) return res.status(400).json(exp);
  res.setHeader('Content-Type', exp.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${exp.filename}"`);
  res.send(exp.content);
});

router.delete('/api/player/sessions/:sessionId', async (req, res) => {
  const out = await deletePlayerSession(String(req.params.sessionId || ''));
  if (out.error === 'session_not_found') return res.status(404).json(out);
  res.json(out);
});

router.get('/api/player/sessions/:sessionId/assets/:kind/:file', async (req, res) => {
  const out = await resolveSessionAssetPath(String(req.params.sessionId || ''), String(req.params.kind || ''), String(req.params.file || ''));
  if (out.error) return res.status(400).json(out);
  try {
    await fs.access(out.path);
    res.sendFile(out.path);
  } catch {
    res.status(404).json({ error: 'asset_not_found' });
  }
});

router.post('/api/player/share-links', async (req, res) => {
  const out = await createShareLink({
    targetType: req.body?.targetType,
    targetRef: req.body?.targetRef,
    createdBy: req.body?.createdBy || null,
    expiresAt: req.body?.expiresAt || null,
    accessMode: req.body?.accessMode || 'internal',
    embed: req.body?.embed || {},
    playbackDefaults: req.body?.playbackDefaults || {},
    autoSession: req.body?.autoSession ?? true
  });
  if (out.error) return res.status(400).json(out);
  res.status(201).json(out);
});

router.get('/api/player/share-links', async (req, res) => {
  const out = await listShareLinks({
    targetType: req.query.targetType ? String(req.query.targetType) : null,
    targetRef: req.query.targetRef ? String(req.query.targetRef) : null,
    status: req.query.status ? String(req.query.status) : null
  });
  res.json(out);
});

router.get('/api/player/share-links/:shareId', async (req, res) => {
  const out = await getShareLink(String(req.params.shareId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.get('/api/player/share-links/:shareId/resolve', async (req, res) => {
  const out = await resolveShareLink(String(req.params.shareId || ''));
  if (out.error === 'share_not_found') return res.status(404).json(out);
  if (out.error === 'share_revoked' || out.error === 'share_expired') return res.status(410).json(out);
  const share = out.share;
  res.json({
    share: {
      shareId: share.shareId,
      targetType: share.targetType,
      targetRef: share.targetRef,
      status: share.status,
      accessMode: share.accessMode,
      expiresAt: share.expiresAt
    },
    embed: normalizeEmbedConfig(share.embed || {}, share.embed?.embedMode || 'standard_embed'),
    playbackDefaults: share.playbackDefaults || { step: 0, autoPlayEnabled: false, autoSession: true }
  });
});

router.patch('/api/player/share-links/:shareId', async (req, res) => {
  const out = await patchShareLink(String(req.params.shareId || ''), req.body || {});
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.delete('/api/player/share-links/:shareId', async (req, res) => {
  const out = await deleteShareLink(String(req.params.shareId || ''));
  if (out.error) return res.status(404).json(out);
  res.json(out);
});

router.post('/api/sessions', async (req, res) => {
  const session = await createSession({ source: req.body?.source, meta: req.body?.meta || {} });
  res.status(201).json({ sessionId: session.sessionId, status: session.status, startedAt: session.startedAt });
});

router.post('/api/sessions/:id/events', async (req, res) => {
  const sessionId = String(req.params.id || '');
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const out = await appendEvents(sessionId, events);
  res.json({ sessionId, ...out });
});

router.post('/api/sessions/:id/stop', async (req, res) => {
  const sessionId = String(req.params.id || '');
  const session = await closeSession(sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  const flow = await finalizeSessionToFlow(sessionId);
  res.json({ sessionId, status: session.status, flowId: flow?.id || null });
});

router.get('/api/flows/:id', async (req, res) => {
  const flowId = String(req.params.id || '');
  const version = String(req.query.version || 'preferred');
  const found = await getFlow(flowId, version);
  if (!found) return res.status(404).json({ error: 'flow_not_found' });
  res.json(found);
});

router.get('/api/flows/:id/compare', async (req, res) => {
  const flowId = String(req.params.id || '');
  const compare = await getFlowCompare(flowId);
  if (compare.error === 'baseline_not_found') return res.status(404).json({ error: 'baseline_not_found' });
  res.json(compare);
});

router.get('/api/flows/:flowId/steps/:stepId/coordinate-replay', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const stepId = String(req.params.stepId || '');
  const replay = await buildStepCoordinateReplay(flowId, stepId);
  if (replay.error === 'flow_not_found') return res.status(404).json(replay);
  if (replay.error === 'step_not_found') return res.status(404).json(replay);
  res.json(replay);
});

router.get('/api/flows/:flowId/steps/:stepId/replay-integrity', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const stepId = String(req.params.stepId || '');
  const includeDiff = String(req.query.includeDiff || '0') === '1';
  const out = await integrityForStep(flowId, stepId, { persist: false, includeDiff });
  if (out.status === 'unreplayable_step') return res.status(200).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/replay-integrity/recompute', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const includeDiff = String(req.query.includeDiff || '0') === '1';
  const out = await integrityRecomputeFlow(flowId, { persist: true, includeDiff });
  if (out.error === 'flow_not_found') return res.status(404).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/snapshots', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await createSnapshot(flowId, { createdBy: req.body?.createdBy || 'editor' });
  if (out.error === 'reviewed_flow_not_found') return res.status(404).json(out);
  if (out.error === 'snapshot_id_collision') return res.status(409).json(out);
  res.status(201).json(out);
});

router.get('/api/flows/:flowId/snapshots', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await listSnapshots(flowId);
  res.json(out);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const out = await getSnapshot(flowId, snapshotId);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  res.json(out);
});

router.get('/api/flows/:flowId/export/verification-metadata', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await getReviewedPackageVerificationMetadata(flowId);
  if (out.error === 'flow_not_found') return res.status(404).json(out);
  if (out.error) return res.status(500).json(out);
  res.json(out);
});

router.get('/api/flows/:flowId/export', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'package') {
    const pkg = await buildReviewedPackage(flowId);
    if (pkg.error === 'flow_not_found') return res.status(404).json(pkg);
    if (pkg.error) return res.status(500).json(pkg);
    res.setHeader('Content-Type', pkg.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
    return res.sendFile(pkg.archivePath, (err) => {
      setTimeout(() => { fs.rm(pkg.cleanupDir, { recursive: true, force: true }).catch(() => {}); }, 500);
      if (err) console.error(err);
    });
  }

  const out = await exportReviewedFlow(flowId, format);
  if (out.error === 'flow_not_found') return res.status(404).json(out);
  if (out.error === 'invalid_export_format') return res.status(400).json(out);
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.send(out.content);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId/export/verification-metadata', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const out = await getSnapshotPackageVerificationMetadata(flowId, snapshotId);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  if (out.error) return res.status(500).json(out);
  res.json(out);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId/export', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'package') {
    const pkg = await buildSnapshotPackage(flowId, snapshotId);
    if (pkg.error === 'snapshot_not_found') return res.status(404).json(pkg);
    if (pkg.error) return res.status(500).json(pkg);
    res.setHeader('Content-Type', pkg.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
    return res.sendFile(pkg.archivePath, (err) => {
      setTimeout(() => { fs.rm(pkg.cleanupDir, { recursive: true, force: true }).catch(() => {}); }, 500);
      if (err) console.error(err);
    });
  }

  const out = await exportSnapshot(flowId, snapshotId, format);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  if (out.error === 'invalid_export_format') return res.status(400).json(out);
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.send(out.content);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId/integrity', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const out = await verifySnapshotIntegrity(flowId, snapshotId);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/snapshots/integrity/recompute', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await recomputeFlowSnapshotIntegrity(flowId);
  res.json(out);
});

router.post('/api/revealpkg/verify', async (req, res) => {
  const meta = req.body || {};
  const ctx = await getSigningContext();
  const out = await verifyVerificationMetadata(meta, ctx);
  res.json(out);
});

router.post('/api/flows/:flowId/review/init', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const flow = await initReviewedFlow(flowId);
  if (!flow) return res.status(404).json({ error: 'flow_not_found' });
  res.status(201).json({ source: 'reviewed', flow });
});

router.patch('/api/flows/:flowId/steps/:stepId', async (req, res) => {
  const result = await updateStep(String(req.params.flowId), String(req.params.stepId), req.body || {});
  if (result.error === 'flow_not_found') return res.status(404).json({ error: result.error });
  if (result.error === 'step_not_found') return res.status(404).json({ error: result.error });
  if (result.error === 'invalid_title') return res.status(400).json({ error: result.error });
  res.json({ ok: true, flow: result.flow, step: result.step });
});

router.post('/api/flows/:flowId/steps/reorder', async (req, res) => {
  const orderedStepIds = Array.isArray(req.body?.orderedStepIds) ? req.body.orderedStepIds : [];
  const result = await reorderSteps(String(req.params.flowId), orderedStepIds);
  if (result.error) {
    const code = result.error === 'flow_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json({ ok: true, flow: result.flow });
});

router.post('/api/flows/:flowId/steps/merge', async (req, res) => {
  const stepIds = Array.isArray(req.body?.stepIds) ? req.body.stepIds : [];
  const merge = req.body?.merge || {};
  const result = await mergeSteps(String(req.params.flowId), stepIds, merge);
  if (result.error) {
    const code = result.error === 'flow_not_found' || result.error === 'step_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json({ ok: true, flow: result.flow, mergedStep: result.mergedStep });
});

router.delete('/api/flows/:flowId/steps/:stepId', async (req, res) => {
  const result = await deleteStep(String(req.params.flowId), String(req.params.stepId));
  if (result.error) {
    const code = result.error === 'flow_not_found' || result.error === 'step_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json({ ok: true, flow: result.flow });
});

router.post('/api/flows/:flowId/steps/:stepId/annotations', async (req, res) => {
  const body = req.body || {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'invalid_annotation_payload' });
  if (!String(body.text || '').trim()) return res.status(400).json({ error: 'invalid_annotation_payload' });

  const result = await addAnnotation(String(req.params.flowId), String(req.params.stepId), body);
  if (result.error) {
    const code = result.error === 'flow_not_found' || result.error === 'step_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.status(201).json({ ok: true, flow: result.flow, annotation: result.annotation });
});

router.get('/api/flows/:flowId/review', async (req, res) => {
  const flow = await getReview(String(req.params.flowId));
  if (!flow) return res.status(404).json({ error: 'review_not_found' });
  res.json({ source: 'reviewed', flow });
});

router.put('/api/flows/:flowId/review', async (req, res) => {
  const result = await replaceReview(String(req.params.flowId), req.body || {});
  if (result.error === 'flow_not_found') return res.status(404).json({ error: result.error });
  res.json({ ok: true, source: 'reviewed', flow: result.flow });
});

function renderPlayerHtml(flowId, boot = {}) {
  const bootJson = JSON.stringify(boot).replace(/</g, '\\u003c');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reveal Flow Player</title>
  <link rel="stylesheet" href="/reveal/player/player.css" />
</head>
<body>
  <script>window.REVEAL_PLAYER_BOOT = ${bootJson};</script>
  <div class="wrap ${boot?.embed?.embedMode || ''}">
    <section class="viewer">
      <h2 id="flow">Reveal Player</h2>
      <div id="resume-note" class="small"></div>
      <div class="stage"><img id="shot" alt="step" /><div id="hotspots"></div></div>
      <div class="overlay" id="overlay"></div>
      <div class="ctrls" id="controls">
        <button id="restart">Restart</button>
        <button id="prev">Previous</button>
        <button id="next">Next</button>
        <button id="dismiss">Dismiss Overlay</button>
        <button id="auto">Auto Play</button>
      </div>
    </section>
    <aside class="panel" id="panel">
      <h3 id="title">Step</h3>
      <div id="meta" class="small"></div>
      <p id="intent"></p>
      <h4>Annotations</h4>
      <ul id="annotations"></ul>
    </aside>
  </div>
  <script src="/reveal/player/player.js"></script>
</body>
</html>`;
}

router.get('/editor/:flowId', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reveal Flow Editor</title>
  <link rel="stylesheet" href="/reveal/editor/editor.css" />
</head>
<body>
  <div id="reveal-editor" data-flow-id="${flowId}">
    <aside class="timeline">
      <h3>Steps</h3>
      <ul id="timeline-list"></ul>
      <div class="timeline-actions">
        <button data-action="move-up">Move Up</button>
        <button data-action="move-down">Move Down</button>
        <button data-action="merge">Merge Selected</button>
      </div>
    </aside>
    <main class="detail">
      <header>
        <h2 id="step-title">Step Detail</h2>
        <div class="actions">
          <button data-action="rename">Rename</button>
          <button data-action="delete">Delete</button>
          <button data-action="annotate">Annotate</button>
          <button data-action="reload">Reload</button>
          <button data-action="compare-toggle">Compare: On</button>
          <button data-action="integrity-recompute">Recompute Integrity</button>
          <button data-action="snapshot-create">Create Snapshot</button>
          <button data-action="export-reviewed-json">Export Reviewed JSON</button>
          <button data-action="export-reviewed-md">Export Reviewed MD</button>
          <button data-action="export-reviewed-package">Export Reviewed Package</button>
          <button data-action="share-create-flow">Create Share Link</button>
          <button data-action="share-list-flow">List Shares</button>
        </div>
      </header>
      <section class="meta" id="step-meta"></section>
      <section class="compare" id="compare-panel"></section>
      <section class="screenshots">
        <div><h4>Before</h4><img id="shot-before" alt="before" /></div>
        <div><h4>After</h4><img id="shot-after" alt="after" /></div>
        <div><h4>Highlight</h4><img id="shot-highlight" alt="highlight" /></div>
      </section>
      <section id="coord-inspector" class="compare"></section>
      <details class="compare">
        <summary>Coordinate Replay Debugger (read-only)</summary>
        <pre id="debugger-panel" class="dbg-pre"></pre>
      </details>
      <section class="compare">
        <h4>Snapshots</h4>
        <select id="snapshot-select"></select>
        <div class="actions">
          <button data-action="snapshot-refresh">Refresh Snapshots</button>
          <button data-action="snapshot-integrity-recompute">Recompute Snapshot Integrity</button>
          <button data-action="export-snapshot-json">Export Snapshot JSON</button>
          <button data-action="export-snapshot-md">Export Snapshot MD</button>
          <button data-action="export-snapshot-package">Export Snapshot Package</button>
          <button data-action="share-create-snapshot">Create Snapshot Share</button>
        </div>
        <pre id="snapshot-summary" class="dbg-pre"></pre>
      </section>
      <section class="compare">
        <h4>Narration Script</h4>
        <div class="actions">
          <select id="script-style">
            <option value="neutral_walkthrough">neutral_walkthrough</option>
            <option value="concise_training">concise_training</option>
            <option value="executive_overview">executive_overview</option>
          </select>
          <button data-action="script-generate-flow">Generate from Flow</button>
          <button data-action="script-generate-snapshot">Generate from Snapshot</button>
          <button data-action="script-generate-session">Generate from Session</button>
          <button data-action="script-review-init">Init Script Review</button>
          <button data-action="script-review-edit-section">Edit Reviewed Section</button>
          <button data-action="script-review-add-note">Add Section Note</button>
          <button data-action="script-review-diff">View Script Diff</button>
          <button data-action="script-review-status">Update Review Status</button>
          <button data-action="script-review-snapshot-create">Create Reviewed Snapshot</button>
          <button data-action="script-review-snapshot-list">List Reviewed Snapshots</button>
          <button data-action="script-review-snapshot-integrity-recompute">Recompute Snapshot Integrity</button>
          <button data-action="script-review-trust-publish">Publish Trust Head</button>
          <button data-action="script-review-trust-latest">View Latest Trust Publication</button>
          <button data-action="script-review-verify-latest">Verify Latest (External)</button>
          <button data-action="script-review-proof-export-json">Export Proof Bundle JSON</button>
          <button data-action="script-review-proof-export-zip">Export Proof Bundle ZIP</button>
          <button data-action="script-review-audit-report">View Audit Report</button>
          <button data-action="script-review-gate">Check Publish Gate</button>
          <button data-action="script-review-export-json">Export Reviewed JSON</button>
          <button data-action="script-review-export-md">Export Reviewed MD</button>
          <button data-action="script-review-publish-export-md">Export Publish-Ready MD</button>
          <button data-action="script-export-json">Export Script JSON</button>
          <button data-action="script-export-md">Export Script MD</button>
          <button data-action="shotlist-generate-script">Generate Shot List (Script)</button>
          <button data-action="shotlist-generate-flow">Generate Shot List (Flow)</button>
          <button data-action="shotlist-generate-session">Generate Shot List (Session)</button>
          <button data-action="shotlist-export-json">Export Shot List JSON</button>
          <button data-action="shotlist-export-md">Export Shot List MD</button>
          <button data-action="shotlist-add-edit-intent">Add Shot Edit Intent</button>
          <button data-action="shotlist-view-with-diff">View Effective vs Baseline</button>
          <button data-action="shotlist-snapshot-create">Create Shot List Snapshot</button>
          <button data-action="shotlist-snapshot-list">List Shot List Snapshots</button>
          <button data-action="shotlist-export-assembly">Export Assembly Package</button>
          <button data-action="voiceplan-generate-script">Generate Voice Plan (Script)</button>
          <button data-action="voiceplan-generate-shotlist">Generate Voice Plan (Shot List)</button>
          <button data-action="voiceplan-export-json">Export Voice Plan JSON</button>
          <button data-action="voiceplan-export-md">Export Voice Plan MD</button>
          <button data-action="voiceplan-export-srt">Export Voice Plan SRT</button>
          <button data-action="voiceplan-export-vtt">Export Voice Plan VTT</button>
          <button data-action="voiceplan-snapshot-create">Create Voice Plan Snapshot</button>
          <button data-action="voiceplan-snapshot-list">List Voice Plan Snapshots</button>
          <button data-action="voiceplan-integrity-recompute">Recompute Voice Snapshot Integrity</button>
          <button data-action="voiceplan-export-bundle">Export Subtitle Bundle</button>
          <button data-action="voiceplan-trust-publish">Publish Voice Trust</button>
          <button data-action="voiceplan-trust-latest">View Latest Voice Trust</button>
          <button data-action="voiceplan-verify-latest">Verify Latest Voice</button>
          <button data-action="voiceplan-export-signed-bundle">Export Signed Subtitle Bundle</button>
          <button data-action="voiceplan-verify-bundle">Verify Signed Bundle JSON</button>
          <button data-action="voiceplan-audit-report">Voice Audit Report</button>
          <button data-action="unified-generate">Generate Unified Verifier</button>
          <button data-action="unified-export-attestation">Export Attestation Bundle</button>
          <button data-action="unified-attestation-snapshot-create">Create Attestation Snapshot</button>
          <button data-action="unified-attestation-snapshot-list">List Attestation Snapshots</button>
          <button data-action="unified-attestation-trust-publish">Publish Attestation Trust</button>
          <button data-action="unified-attestation-trust-latest">View Latest Attestation Trust</button>
          <button data-action="external-generate">Generate External Verifier</button>
          <button data-action="external-latest">View Latest External Verdict</button>
          <button data-action="external-export-verdict">Export Compliance Verdict</button>
          <button data-action="adapter-generate">Generate Render Adapter Contract</button>
          <button data-action="adapter-export-manifest">Export Adapter Manifest</button>
          <button data-action="adapter-validate">Validate Adapter Contract</button>
          <button data-action="adapter-trust-publish">Publish Adapter Trust</button>
          <button data-action="adapter-trust-latest">View Latest Adapter Trust</button>
          <button data-action="provider-adapter-generate">Generate Provider Adapter</button>
          <button data-action="provider-profile-list">List Provider Profiles</button>
          <button data-action="provider-adapter-export-manifest">Export Provider Manifest</button>
          <button data-action="provider-adapter-validate">Validate Provider Adapter/Manifest</button>
          <button data-action="provider-exec-generate">Generate Provider Execution Adapter</button>
          <button data-action="provider-exec-export-payload">Export Provider Execution Payload</button>
          <button data-action="provider-exec-validate">Validate Provider Execution Payload</button>
          <button data-action="provider-submission-generate">Generate Provider Submission</button>
          <button data-action="provider-submission-export-payload">Export Submission Payload</button>
          <button data-action="provider-submission-export-signed">Export Signed Submission</button>
          <button data-action="provider-submission-validate">Validate Submission Payload</button>
          <button data-action="provider-submission-trust-publish">Publish Submission Trust</button>
          <button data-action="provider-submission-trust-latest">View Latest Submission Trust</button>
          <button data-action="execution-receipt-create">Create Execution Receipt</button>
          <button data-action="execution-receipt-update">Update Execution Receipt</button>
          <button data-action="execution-receipt-export">Export Execution Receipt</button>
          <button data-action="execution-receipt-export-signed">Export Signed Receipt</button>
          <button data-action="execution-receipt-trust-publish">Publish Receipt Trust</button>
          <button data-action="execution-receipt-trust-latest">View Latest Receipt Trust</button>
          <button data-action="execution-callback-submit">Submit Execution Callback</button>
          <button data-action="execution-callback-verify">Verify Execution Callback</button>
          <button data-action="execution-callback-view">View Execution Callback</button>
          <button data-action="scheduler-board-generate">Generate Scheduler Board</button>
          <button data-action="scheduler-board-latest">View Latest Scheduler Board</button>
          <button data-action="scheduler-board-export">Export Scheduler Board</button>
          <button data-action="scheduler-board-verify">Verify Scheduler Board</button>
          <button data-action="admission-create">Create Admission Certificate</button>
          <button data-action="admission-latest">View Scheduler Admission Latest</button>
          <button data-action="admission-export-signed">Export Signed Certificate</button>
          <button data-action="proof-create">Create Orchestration Proof</button>
          <button data-action="proof-latest">View Latest Orchestration Proof</button>
          <button data-action="proof-export-signed">Export Signed Proof</button>
          <button data-action="proof-verify">Verify Proof</button>
          <button data-action="handoff-verify">Verify Handoff Artifact</button>
          <button data-action="unified-verify-zip">Verify ZIP Bundle</button>
          <button data-action="policy-list">List Policy Manifests</button>
        </div>
        <pre id="script-preview" class="dbg-pre">No script generated.</pre>
      </section>
      <section>
        <h4>Annotations</h4>
        <ul id="annotations"></ul>
      </section>
    </main>
  </div>
  <script src="/reveal/editor/editor.js"></script>
</body>
</html>`);
});

router.get('/player/:flowId', async (req, res) => {
  const embed = normalizeEmbedConfig({
    embedMode: req.query.mode ? String(req.query.mode) : (String(req.query.embed || '0') === '1' ? 'minimal_embed' : 'standard_embed')
  });
  const boot = {
    flowId: String(req.params.flowId || ''),
    snapshotId: req.query.snapshotId ? String(req.query.snapshotId) : null,
    sessionId: req.query.sessionId ? String(req.query.sessionId) : null,
    share: null,
    embed,
    readOnly: false
  };
  res.type('html').send(renderPlayerHtml(String(req.params.flowId || ''), boot));
});

router.get('/share/:shareId', async (req, res) => {
  const out = await resolveShareLink(String(req.params.shareId || ''));
  if (out.error === 'share_not_found') return res.status(404).type('html').send('<h1>Share not found</h1>');
  if (out.error === 'share_revoked') return res.status(410).type('html').send('<h1>Share revoked</h1>');
  if (out.error === 'share_expired') return res.status(410).type('html').send('<h1>Share expired</h1>');

  const share = out.share;
  const boot = {
    flowId: share.targetType === 'flow' ? share.targetRef : '',
    snapshotId: share.targetType === 'snapshot' ? share.targetRef : null,
    sessionId: share.targetType === 'session' ? share.targetRef : null,
    share: {
      shareId: share.shareId,
      targetType: share.targetType,
      status: share.status,
      accessMode: share.accessMode,
      expiresAt: share.expiresAt
    },
    embed: normalizeEmbedConfig(share.embed || {}, share.embed?.embedMode || 'standard_embed'),
    readOnly: true,
    playbackDefaults: share.playbackDefaults || { step: 0, autoPlayEnabled: false, autoSession: true }
  };

  res.type('html').send(renderPlayerHtml('', boot));
});

router.get('/share/:shareId/embed', async (req, res) => {
  const out = await resolveShareLink(String(req.params.shareId || ''));
  if (out.error === 'share_not_found') return res.status(404).type('html').send('<h1>Share not found</h1>');
  if (out.error === 'share_revoked') return res.status(410).type('html').send('<h1>Share revoked</h1>');
  if (out.error === 'share_expired') return res.status(410).type('html').send('<h1>Share expired</h1>');

  const share = out.share;
  const boot = {
    flowId: share.targetType === 'flow' ? share.targetRef : '',
    snapshotId: share.targetType === 'snapshot' ? share.targetRef : null,
    sessionId: share.targetType === 'session' ? share.targetRef : null,
    share: {
      shareId: share.shareId,
      targetType: share.targetType,
      status: share.status,
      accessMode: share.accessMode,
      expiresAt: share.expiresAt
    },
    embed: normalizeEmbedConfig({ ...(share.embed || {}), embedMode: share.embed?.embedMode || 'minimal_embed' }, 'minimal_embed'),
    readOnly: true,
    playbackDefaults: share.playbackDefaults || { step: 0, autoPlayEnabled: false, autoSession: true }
  };
  res.type('html').send(renderPlayerHtml('', boot));
});

export default router;
