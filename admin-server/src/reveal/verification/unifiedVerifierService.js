import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getReviewedScript } from '../script/reviewedScriptService.js';
import { recomputeReviewedSnapshotIntegrity } from '../script/reviewedScriptSnapshotService.js';
import { getLatestTrustPublication } from '../script/reviewedSnapshotTrustPublicationService.js';
import { getShotListSnapshot } from '../production/shotListSnapshotService.js';
import { getShotList } from '../production/shotListService.js';
import { getVoiceTrackPlan } from '../production/voiceTrackPlanService.js';
import { recomputeVoicePlanSnapshotIntegrity } from '../production/voicePlanIntegrityService.js';
import { getLatestVoiceTrustPublication } from '../production/voiceTrustPublicationService.js';
import { buildVoiceTrackAuditReport } from '../production/subtitleBundleService.js';
import { getPolicyManifest } from './policyManifestService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/unified-verifier-packages';
function id(){return `uvp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;}
function fileFor(verifierPackageId){return path.join(ROOT, `${verifierPackageId}.json`);} 

async function writePkg(p){await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(p.verifierPackageId), JSON.stringify(p,null,2));}
export async function getUnifiedVerifierPackage(verifierPackageId){ try{return {verifierPackage: JSON.parse(await fs.readFile(fileFor(verifierPackageId),'utf8'))};}catch{return {error:'verifier_package_not_found'};} }

function overallStatus({ blockingReasons = [], warnings = [], domainStatuses = [] }) {
  if (blockingReasons.length) {
    if (blockingReasons.some((x) => String(x).includes('missing'))) return 'missing_required_artifact';
    if (blockingReasons.some((x) => String(x).includes('integrity') || String(x).includes('mismatch') || String(x).includes('chain'))) return 'integrity_failed';
    if (blockingReasons.some((x) => String(x).includes('trust'))) return 'trust_publication_missing';
    return 'blocked';
  }
  if (domainStatuses.some((s) => s !== 'verified')) return 'partially_verified';
  if (warnings.length) return 'partially_verified';
  return 'verified';
}

function evaluatePolicy(profile, summaries){
  const blockingReasons = [];
  const warnings = [];

  const scriptIntegrityOk = summaries.scriptTrustSummary?.integritySummary?.brokenChainLinks === 0 && summaries.scriptTrustSummary?.integritySummary?.mismatched === 0;
  const voiceIntegrityOk = summaries.voiceTrustSummary?.integritySummary?.brokenChainLinks === 0 && summaries.voiceTrustSummary?.integritySummary?.mismatched === 0;
  const scriptTrustSigned = summaries.scriptTrustSummary?.trustPublication?.signatureStatus === 'signed';
  const voiceTrustSigned = summaries.voiceTrustSummary?.trustPublication?.signatureStatus === 'signed';
  const subtitleSigned = summaries.subtitleProofSummary?.signedProofStatus === 'signed';

  if (profile.policyProfileId === 'dev') {
    if (!summaries.scriptTrustSummary?.trustPublication) warnings.push('missing_trust_publication');
    if (summaries.subtitleProofSummary?.signedProofStatus !== 'signed') warnings.push('unsigned_proof');
  }

  if (profile.policyProfileId === 'internal_verified') {
    if (!scriptIntegrityOk || !voiceIntegrityOk) blockingReasons.push('integrity_failed');
    if (!summaries.voiceTrustSummary?.trustPublication) blockingReasons.push('trust_publication_missing');
    if (!subtitleSigned) warnings.push('unsigned_proof');
  }

  if (profile.policyProfileId === 'production_verified') {
    if (!scriptIntegrityOk || !voiceIntegrityOk) blockingReasons.push('integrity_failed');
    if (!summaries.scriptTrustSummary?.trustPublication || !summaries.voiceTrustSummary?.trustPublication) blockingReasons.push('trust_publication_missing');
    if (!scriptTrustSigned || !voiceTrustSigned) blockingReasons.push('unsigned_trust_publication');
    if (!subtitleSigned) blockingReasons.push('unsigned_subtitle_proof');
  }

  return {
    orchestrationPolicyProfile: profile.policyProfileId,
    policyManifestVersion: profile.version,
    policyEvaluationResult: blockingReasons.length ? 'blocked' : (warnings.length ? 'warning' : 'pass'),
    blockingReasons,
    warnings
  };
}

export async function createUnifiedVerifierPackage({ scriptId = null, shotListId = null, shotListSnapshotId = null, voiceTrackPlanId = null, voicePlanSnapshotId = null, orchestrationPolicyProfile = 'dev' } = {}) {
  if (!scriptId && !voiceTrackPlanId && !shotListId && !shotListSnapshotId) return { error: 'missing_required_source_refs' };

  const policyOut = await getPolicyManifest(orchestrationPolicyProfile);
  if (policyOut.error) return policyOut;

  let scriptTrustSummary = null;
  if (scriptId) {
    const reviewed = await getReviewedScript(scriptId);
    if (reviewed.error) return reviewed;
    const integ = await recomputeReviewedSnapshotIntegrity(scriptId);
    const trust = await getLatestTrustPublication(scriptId);
    scriptTrustSummary = {
      scriptId,
      reviewStatus: reviewed.reviewed.reviewStatus,
      integritySummary: integ,
      trustPublication: trust.error ? null : { trustPublicationId: trust.trustPublication.trustPublicationId, signatureStatus: trust.trustPublication.trustPublicationSignatureStatus, chainHeadDigest: trust.trustPublication.chainHeadDigest }
    };
  }

  let shotTrustSummary = null;
  if (shotListId || shotListSnapshotId) {
    if (shotListSnapshotId && shotListId) {
      const snap = await getShotListSnapshot(shotListId, shotListSnapshotId);
      shotTrustSummary = snap.error ? null : { shotListId, shotListSnapshotId, sourceTrustRefs: snap.snapshot.sourceTrustRefs || null, snapshotCreatedAt: snap.snapshot.createdAt };
    } else if (shotListId) {
      const sl = await getShotList(shotListId);
      shotTrustSummary = sl.error ? null : { shotListId, sourceTrustRefs: sl.shotList.metadata?.sourceApprovalTrust || null };
    }
  }

  let voiceTrustSummary = null;
  let subtitleProofSummary = null;
  if (voiceTrackPlanId) {
    const plan = await getVoiceTrackPlan(voiceTrackPlanId);
    if (plan.error) return plan;
    const integ = await recomputeVoicePlanSnapshotIntegrity(voiceTrackPlanId);
    const vtrust = await getLatestVoiceTrustPublication(voiceTrackPlanId);
    const audit = await buildVoiceTrackAuditReport(voiceTrackPlanId);

    voiceTrustSummary = {
      voiceTrackPlanId,
      voicePlanSnapshotId,
      integritySummary: integ,
      trustPublication: vtrust.error ? null : { voiceTrustPublicationId: vtrust.voiceTrustPublication.voiceTrustPublicationId, signatureStatus: vtrust.voiceTrustPublication.voiceTrustPublicationSignatureStatus, voiceChainHeadDigest: vtrust.voiceTrustPublication.voiceChainHeadDigest },
      latestVoiceSnapshot: (integ.rows || [])[integ.rows.length - 1] || null
    };

    subtitleProofSummary = {
      voiceTrackPlanId,
      readiness: audit.error ? null : audit.report.signedSubtitleBundleReadiness,
      signedProofStatus: audit.error ? 'unknown' : (audit.report.signedSubtitleBundleReadiness?.policyEvaluationResult === 'pass' ? 'signed' : 'unsigned')
    };
  }

  const policyEval = evaluatePolicy(policyOut.policyManifest, { scriptTrustSummary, shotTrustSummary, voiceTrustSummary, subtitleProofSummary });

  const domainStatuses = [
    scriptTrustSummary ? ((scriptTrustSummary.integritySummary?.brokenChainLinks || 0) === 0 ? 'verified' : 'blocked') : 'missing',
    shotTrustSummary ? 'verified' : 'missing',
    voiceTrustSummary ? ((voiceTrustSummary.integritySummary?.brokenChainLinks || 0) === 0 ? 'verified' : 'blocked') : 'missing',
    subtitleProofSummary ? (policyEval.policyEvaluationResult === 'pass' ? 'verified' : 'warning') : 'missing'
  ];

  const verifierPackage = {
    verifierPackageId: id(),
    createdAt: new Date().toISOString(),
    verifierVersion: 'v1',
    sourceRefs: { scriptId, shotListId, shotListSnapshotId, voiceTrackPlanId, voicePlanSnapshotId },
    scriptTrustSummary,
    shotTrustSummary,
    voiceTrustSummary,
    subtitleProofSummary,
    orchestrationPolicySummary: policyEval,
    overallVerificationStatus: overallStatus({ blockingReasons: policyEval.blockingReasons, warnings: policyEval.warnings, domainStatuses }),
    blockingReasons: policyEval.blockingReasons,
    warnings: policyEval.warnings,
    attestationRefs: { policyProfileId: policyOut.policyManifest.policyProfileId, policyManifestVersion: policyOut.policyManifest.version },
    metadata: { domainStatuses }
  };

  await writePkg(verifierPackage);
  return { verifierPackage };
}

export async function latestUnifiedVerifierPackage() {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  let latest = null;
  for (const f of files) {
    try {
      const obj = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (!latest || String(obj.createdAt).localeCompare(String(latest.createdAt)) > 0) latest = obj;
    } catch {}
  }
  if (!latest) return { error: 'verifier_package_not_found' };
  return { verifierPackage: latest };
}
