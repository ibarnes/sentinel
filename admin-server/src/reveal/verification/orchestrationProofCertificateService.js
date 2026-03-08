import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { resolveProofLinks } from './proofLinkService.js';
import { computeProofDigest } from './proofDigestService.js';
import { signAdmissionCertificate, verifyHandoffArtifact } from './handoffCertificationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/orchestration-proof-certificates';
function id(){return `opc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;}
function fileFor(orchestrationProofCertificateId){return path.join(ROOT, `${orchestrationProofCertificateId}.json`);} 
async function writeCert(c){await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(c.orchestrationProofCertificateId), JSON.stringify(c,null,2));}
export async function getOrchestrationProofCertificate(orchestrationProofCertificateId){ try{return {orchestrationProofCertificate: JSON.parse(await fs.readFile(fileFor(orchestrationProofCertificateId),'utf8'))};}catch{return {error:'orchestration_proof_certificate_not_found'};} }

function evaluateStartDecision({ profile, external, adapterTrust, attTrust, admission }) {
  const blockingReasons = [...(external?.blockingReasons || []), ...(admission?.blockingReasons || [])];
  const warnings = [...(external?.warnings || []), ...(admission?.warnings || [])];

  if (!adapterTrust) blockingReasons.push('adapter_trust_link_missing');
  if (!attTrust) blockingReasons.push('attestation_trust_link_missing');
  if (!admission) blockingReasons.push('admission_certificate_link_missing');

  if (profile === 'production_verified') {
    if (adapterTrust?.adapterManifestSignatureStatus !== 'signed') blockingReasons.push('adapter_manifest_signature_missing');
    if (admission?.certificateSignatureStatus !== 'signed') blockingReasons.push('admission_certificate_signature_invalid');
    if (attTrust?.attestationTrustPublicationSignatureStatus !== 'signed') blockingReasons.push('attestation_trust_link_missing');
  }

  let overallVerdict = 'admit';
  let startDecision = 'start';
  if (blockingReasons.length) {
    overallVerdict = 'deny';
    startDecision = 'no_start';
  } else if (warnings.length) {
    overallVerdict = 'admit_with_warnings';
    startDecision = 'start_with_warnings';
  }

  return { overallVerdict, startDecision, blockingReasons: [...new Set(blockingReasons)], warnings: [...new Set(warnings)] };
}

export async function createOrchestrationProofCertificate({ renderAdapterContractId = null, externalVerifierProfileId = null, admissionCertificateId = null, adapterTrustPublicationId = null, attestationTrustPublicationId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  const links = await resolveProofLinks({ renderAdapterContractId, externalVerifierProfileId, admissionCertificateId, adapterTrustPublicationId, attestationTrustPublicationId, policyProfileId, mode });
  if (links.error) return links;

  const start = evaluateStartDecision({
    profile: policyProfileId,
    external: links.external,
    adapterTrust: links.adapterTrust,
    attTrust: links.attestationTrust,
    admission: links.admission
  });

  const cert = {
    orchestrationProofCertificateId: id(),
    createdAt: new Date().toISOString(),
    certificateVersion: 'v1',
    targetRef: { renderAdapterContractId: links.adapter?.renderAdapterContractId || renderAdapterContractId || null },
    adapterType: links.adapter?.adapterType || null,
    orchestrationProfile: policyProfileId,
    renderAdapterContractId: links.adapter?.renderAdapterContractId || renderAdapterContractId || null,
    externalVerifierProfileId: links.external?.externalVerifierProfileId || null,
    admissionCertificateId: links.admission?.admissionCertificateId || null,
    adapterTrustPublicationRef: links.adapterTrust ? {
      adapterTrustPublicationId: links.adapterTrust.adapterTrustPublicationId,
      adapterChainHeadDigest: links.adapterTrust.adapterChainHeadDigest,
      signatureStatus: links.adapterTrust.adapterManifestSignatureStatus
    } : null,
    attestationTrustPublicationRef: links.attestationTrust ? {
      attestationTrustPublicationId: links.attestationTrust.attestationTrustPublicationId,
      attestationChainHeadDigest: links.attestationTrust.attestationChainHeadDigest,
      signatureStatus: links.attestationTrust.attestationTrustPublicationSignatureStatus
    } : null,
    policyManifestRef: {
      policyProfileId: links.policyManifest.policyProfileId,
      policyProfileName: links.policyManifest.policyProfileName,
      version: links.policyManifest.version,
      signatureStatus: links.policyManifest.policyManifestSignatureStatus
    },
    overallVerdict: start.overallVerdict,
    startDecision: start.startDecision,
    blockingReasons: start.blockingReasons,
    warnings: start.warnings,
    proofDigest: '',
    proofDigestVersion: 'sha256-v1',
    metadata: {
      linkedRefs: {
        adapterTrustPublicationId: links.adapterTrust?.adapterTrustPublicationId || null,
        attestationTrustPublicationId: links.attestationTrust?.attestationTrustPublicationId || null,
        admissionCertificateId: links.admission?.admissionCertificateId || null
      }
    }
  };

  cert.proofDigest = computeProofDigest({
    renderAdapterContractId: cert.renderAdapterContractId,
    adapterTrustHeadDigest: cert.adapterTrustPublicationRef?.adapterChainHeadDigest || null,
    attestationTrustHeadDigest: cert.attestationTrustPublicationRef?.attestationChainHeadDigest || null,
    policyProfileId: cert.policyManifestRef.policyProfileId,
    policyVersion: cert.policyManifestRef.version,
    policySignatureStatus: cert.policyManifestRef.signatureStatus,
    admissionCertificateId: cert.admissionCertificateId,
    admissionReadinessDigest: links.admission?.readinessDigest || null,
    admissionSignatureStatus: links.admission?.certificateSignatureStatus || null,
    orchestrationProfile: cert.orchestrationProfile,
    overallVerdict: cert.overallVerdict,
    startDecision: cert.startDecision,
    blockingReasons: cert.blockingReasons,
    warnings: cert.warnings
  });

  const signed = await signAdmissionCertificate({
    admissionCertificateId: cert.orchestrationProofCertificateId,
    createdAt: cert.createdAt,
    certificateVersion: cert.certificateVersion,
    targetRef: cert.targetRef,
    adapterType: cert.adapterType,
    orchestrationProfile: cert.orchestrationProfile,
    verifierPackageId: links.external?.unifiedPackageSummary?.verifierPackageId || null,
    externalVerifierProfileId: cert.externalVerifierProfileId,
    renderAdapterContractId: cert.renderAdapterContractId,
    overallVerdict: cert.overallVerdict,
    admissionDecision: cert.startDecision,
    blockingReasons: cert.blockingReasons,
    warnings: cert.warnings,
    trustRefs: { adapter: cert.adapterTrustPublicationRef, attestation: cert.attestationTrustPublicationRef },
    readinessDigest: cert.proofDigest
  });

  cert.certificateSignature = signed.certificateSignature;
  cert.certificateSignatureVersion = signed.certificateSignatureVersion;
  cert.certificateSigningKeyId = signed.certificateSigningKeyId;
  cert.certificateSigningAlgorithm = signed.certificateSigningAlgorithm;
  cert.certificateSignatureStatus = signed.certificateSignatureStatus;
  cert.certificateSignatureValid = signed.certificateSignatureValid;

  await writeCert(cert);
  return { orchestrationProofCertificate: cert };
}

export function exportOrchestrationProofCertificate(cert, format = 'json') {
  if (format === 'json' || format === 'signed_proof') {
    return { contentType: 'application/json', filename: `${cert.orchestrationProofCertificateId}${format==='signed_proof' ? '-signed' : ''}.json`, content: JSON.stringify(cert, null, 2) };
  }
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Orchestration Proof ${cert.orchestrationProofCertificateId}`);
  lines.push('', `- Start Decision: ${cert.startDecision}`);
  lines.push(`- Verdict: ${cert.overallVerdict}`);
  lines.push(`- Proof Digest: ${cert.proofDigest}`);
  lines.push(`- Signature Status: ${cert.certificateSignatureStatus}`);
  lines.push(`- Blocking: ${(cert.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(cert.warnings || []).join(', ') || 'none'}`);
  return { contentType: 'text/markdown; charset=utf-8', filename: `${cert.orchestrationProofCertificateId}.md`, content: lines.join('\n') + '\n' };
}

export async function latestOrchestrationProofCertificate({ renderAdapterContractId = null, policyProfileId = 'dev', adapterType = null, mode = 'latest' } = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  let latest = null;
  for (const f of files) {
    try {
      const c = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (renderAdapterContractId && c.renderAdapterContractId !== renderAdapterContractId) continue;
      if (policyProfileId && c.orchestrationProfile !== policyProfileId) continue;
      if (adapterType && c.adapterType !== adapterType) continue;
      if (!latest || String(c.createdAt).localeCompare(String(latest.createdAt)) > 0) latest = c;
    } catch {}
  }
  if (latest && mode !== 'latest') return { orchestrationProofCertificate: latest };
  return createOrchestrationProofCertificate({ renderAdapterContractId, policyProfileId, mode: 'latest' });
}

export async function verifyProofCertificate(payloadOrRef = {}) {
  let cert = null;
  if (payloadOrRef?.orchestrationProofCertificateId) {
    const got = await getOrchestrationProofCertificate(payloadOrRef.orchestrationProofCertificateId);
    if (got.error) return got;
    cert = got.orchestrationProofCertificate;
  } else cert = payloadOrRef;

  if (!cert || typeof cert !== 'object') return { status: 'malformed_proof', reasonCodes: ['missing_proof'] };

  const recomputed = computeProofDigest({
    renderAdapterContractId: cert.renderAdapterContractId,
    adapterTrustHeadDigest: cert.adapterTrustPublicationRef?.adapterChainHeadDigest || null,
    attestationTrustHeadDigest: cert.attestationTrustPublicationRef?.attestationChainHeadDigest || null,
    policyProfileId: cert.policyManifestRef?.policyProfileId,
    policyVersion: cert.policyManifestRef?.version,
    policySignatureStatus: cert.policyManifestRef?.signatureStatus,
    admissionCertificateId: cert.admissionCertificateId,
    admissionReadinessDigest: cert.proofDigest,
    admissionSignatureStatus: cert.certificateSignatureStatus,
    orchestrationProfile: cert.orchestrationProfile,
    overallVerdict: cert.overallVerdict,
    startDecision: cert.startDecision,
    blockingReasons: cert.blockingReasons,
    warnings: cert.warnings
  });

  if (!cert.proofDigest) return { status: 'proof_digest_mismatch', reasonCodes: ['proof_digest_missing'] };
  if (cert.proofDigest !== recomputed) return { status: 'proof_digest_mismatch', reasonCodes: ['proof_digest_mismatch'], storedProofDigest: cert.proofDigest, recomputedProofDigest: recomputed };

  const verifySig = await verifyHandoffArtifact('signed_certificate', {
    admissionCertificateId: cert.orchestrationProofCertificateId,
    createdAt: cert.createdAt,
    certificateVersion: cert.certificateVersion,
    targetRef: cert.targetRef,
    adapterType: cert.adapterType,
    orchestrationProfile: cert.orchestrationProfile,
    verifierPackageId: cert.verifierPackageId || null,
    externalVerifierProfileId: cert.externalVerifierProfileId,
    renderAdapterContractId: cert.renderAdapterContractId,
    overallVerdict: cert.overallVerdict,
    admissionDecision: cert.startDecision,
    blockingReasons: cert.blockingReasons,
    warnings: cert.warnings,
    trustRefs: { adapter: cert.adapterTrustPublicationRef, attestation: cert.attestationTrustPublicationRef },
    readinessDigest: cert.proofDigest,
    certificateSignature: cert.certificateSignature
  });

  if (verifySig.status === 'invalid_signature') return { status: 'invalid_signature', reasonCodes: ['signature_verification_failed'] };
  if (verifySig.status === 'unsigned') return { status: 'unsigned', reasonCodes: ['missing_signature'] };

  if (!cert.adapterTrustPublicationRef || !cert.attestationTrustPublicationRef || !cert.admissionCertificateId) {
    return { status: 'missing_required_link', reasonCodes: ['proof_link_mismatch'] };
  }

  return { status: 'verified', reasonCodes: ['signature_verified','proof_digest_verified'] };
}
