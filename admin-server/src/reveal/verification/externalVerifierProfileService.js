import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getUnifiedVerifierPackage, latestUnifiedVerifierPackage, createUnifiedVerifierPackage } from './unifiedVerifierService.js';
import { getPolicyManifest, verifyPolicyManifest } from './policyManifestService.js';
import { listAttestationSnapshots } from './attestationSnapshotService.js';
import { getLatestAttestationTrustPublication } from './attestationTrustPublicationService.js';
import { deriveComplianceVerdict } from './complianceVerdictService.js';
import { verifyLatestVoice } from '../production/voiceVerificationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/external-verifier-profiles';
function id(){ return `evp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function fileFor(externalVerifierProfileId){ return path.join(ROOT, `${externalVerifierProfileId}.json`); }
async function writeProfile(p){ await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(p.externalVerifierProfileId), JSON.stringify(p,null,2)); }
export async function getExternalVerifierProfile(externalVerifierProfileId){ try{return {externalVerifierProfile: JSON.parse(await fs.readFile(fileFor(externalVerifierProfileId),'utf8'))};}catch{return {error:'external_verifier_profile_not_found'};} }

function assessAttestationTrust(latestAttSnap, latestAttPub) {
  if (!latestAttPub || latestAttPub.error) return { status: 'missing_publication', valid: false };
  const p = latestAttPub.attestationTrustPublication;
  if (p.attestationTrustPublicationSignatureStatus === 'signed' && !p.attestationTrustPublicationSignature) return { status: 'invalid_signature', valid: false };
  if (p.attestationTrustPublicationSignatureStatus !== 'signed') return { status: 'unsigned', valid: null };

  if (!latestAttSnap) return { status: 'missing_publication', valid: false };
  if (p.latestAttestationSnapshotId !== latestAttSnap.attestationSnapshotId || p.latestAttestationSnapshotContentHash !== latestAttSnap.attestationSnapshotContentHash) {
    return { status: 'chain_head_mismatch', valid: false };
  }
  return { status: 'valid', valid: true };
}

export async function createExternalVerifierProfile({ verifierPackageId = null, scriptId = null, shotListId = null, voiceTrackPlanId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  if (!['latest','explicit_refs'].includes(String(mode || ''))) return { error: 'invalid_mode' };

  let unified;
  if (verifierPackageId) {
    const got = await getUnifiedVerifierPackage(verifierPackageId);
    if (got.error) return got;
    unified = got.verifierPackage;
  } else if (mode === 'latest') {
    const got = await latestUnifiedVerifierPackage();
    if (got.error) {
      const created = await createUnifiedVerifierPackage({ scriptId, shotListId, voiceTrackPlanId, orchestrationPolicyProfile: policyProfileId });
      if (created.error) return created;
      unified = created.verifierPackage;
    } else unified = got.verifierPackage;
  } else {
    const created = await createUnifiedVerifierPackage({ scriptId, shotListId, voiceTrackPlanId, orchestrationPolicyProfile: policyProfileId });
    if (created.error) return created;
    unified = created.verifierPackage;
  }

  const policy = await getPolicyManifest(policyProfileId);
  if (policy.error) return policy;
  const policyValidity = await verifyPolicyManifest(policyProfileId);

  const verifierPackageIdResolved = unified.verifierPackageId;
  const attSnaps = await listAttestationSnapshots(verifierPackageIdResolved);
  const latestAttSnap = (attSnaps.snapshots || []).length ? [...attSnaps.snapshots].sort((a,b)=>Number(b.attestationSnapshotChainIndex||0)-Number(a.attestationSnapshotChainIndex||0))[0] : null;
  const latestAttPub = await getLatestAttestationTrustPublication(verifierPackageIdResolved);
  const attTrustStatus = assessAttestationTrust(latestAttSnap, latestAttPub);

  const voiceVerify = unified.sourceRefs?.voiceTrackPlanId ? await verifyLatestVoice(unified.sourceRefs.voiceTrackPlanId) : null;

  const verdict = deriveComplianceVerdict({
    policySummary: unified.orchestrationPolicySummary,
    domainChecks: {
      attestationTrustPublicationStatus: attTrustStatus.status,
      policyManifestStatus: policyValidity.status
    }
  });

  const profile = {
    externalVerifierProfileId: id(),
    createdAt: new Date().toISOString(),
    verifierVersion: 'v1',
    targetRef: { verifierPackageId: verifierPackageIdResolved },
    policyProfileId: policy.policyManifest.policyProfileId,
    policyProfileName: policy.policyManifest.policyProfileName,
    evaluatedArtifactRefs: unified.sourceRefs,
    unifiedPackageSummary: {
      verifierPackageId: unified.verifierPackageId,
      overallVerificationStatus: unified.overallVerificationStatus
    },
    attestationSnapshotSummary: {
      latestAttestationSnapshotId: latestAttSnap?.attestationSnapshotId || null,
      latestAttestationSnapshotChainIndex: latestAttSnap?.attestationSnapshotChainIndex || null,
      latestAttestationSnapshotContentHash: latestAttSnap?.attestationSnapshotContentHash || null
    },
    attestationTrustPublicationSummary: latestAttPub.error ? { status: 'missing_publication' } : {
      status: attTrustStatus.status,
      attestationTrustPublicationId: latestAttPub.attestationTrustPublication.attestationTrustPublicationId,
      attestationChainHeadDigest: latestAttPub.attestationTrustPublication.attestationChainHeadDigest,
      signatureStatus: latestAttPub.attestationTrustPublication.attestationTrustPublicationSignatureStatus
    },
    policyManifestSummary: {
      policyProfileId: policy.policyManifest.policyProfileId,
      version: policy.policyManifest.version,
      signatureStatus: policy.policyManifest.policyManifestSignatureStatus,
      validityStatus: policyValidity.status
    },
    sourceTrustSummary: {
      script: unified.scriptTrustSummary,
      shot: unified.shotTrustSummary,
      voice: unified.voiceTrustSummary,
      subtitle: unified.subtitleProofSummary,
      voiceVerifier: voiceVerify && !voiceVerify.error ? voiceVerify : null
    },
    overallVerdict: verdict.overallVerdict,
    blockingReasons: verdict.blockingReasons,
    warnings: verdict.warnings,
    admissionDecision: verdict.admissionDecision,
    metadata: {
      mode,
      policyEvaluationResult: unified.orchestrationPolicySummary,
      evaluatedAt: new Date().toISOString()
    }
  };

  await writeProfile(profile);
  return { externalVerifierProfile: profile };
}

export async function latestExternalVerifierProfile({ policyProfileId = 'dev', verifierPackageId = null, mode = 'latest' } = {}) {
  if (verifierPackageId) {
    return createExternalVerifierProfile({ verifierPackageId, policyProfileId, mode: 'explicit_refs' });
  }

  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f)=>f.endsWith('.json'));
  let latest = null;
  for (const f of files) {
    try {
      const obj = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (obj.policyProfileId !== policyProfileId) continue;
      if (!latest || String(obj.createdAt).localeCompare(String(latest.createdAt)) > 0) latest = obj;
    } catch {}
  }
  if (!latest || mode === 'latest') {
    const created = await createExternalVerifierProfile({ policyProfileId, mode: 'latest' });
    return created;
  }
  return { externalVerifierProfile: latest };
}
