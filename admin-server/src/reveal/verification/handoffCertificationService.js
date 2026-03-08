import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';

function canonicalize(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalize);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const cv = canonicalize(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

function signPayload(payload, privateKey) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(canonicalize(payload)));
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function verifyPayload(payload, signature, publicKey) {
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(JSON.stringify(canonicalize(payload)));
  verifier.end();
  return verifier.verify(publicKey, signature, 'base64');
}

export async function signAdapterManifest(contract) {
  const ctx = await getSigningContext();
  const payload = {
    renderAdapterContractId: contract.renderAdapterContractId,
    contractVersion: contract.contractVersion,
    adapterType: contract.adapterType,
    orchestrationProfile: contract.orchestrationProfile,
    sourceRefs: contract.sourceRefs,
    readinessState: contract.readinessState,
    executionPlan: contract.executionPlan,
    inputArtifacts: contract.inputArtifacts,
    outputTargets: contract.outputTargets,
    policyEvaluation: contract.policyEvaluation
  };

  if (!ctx.enabled) {
    return {
      ...contract,
      adapterManifestSignature: null,
      adapterManifestSignatureVersion: 'adapter-manifest-sig-v1',
      adapterManifestSigningKeyId: null,
      adapterManifestSigningAlgorithm: 'RSA-SHA256',
      adapterManifestSignatureStatus: 'unsigned',
      adapterManifestSignatureValid: null,
      adapterManifestVerificationScope: 'adapter-manifest-core',
      unsignedReason: ctx.unsignedReason || 'missing_key'
    };
  }

  const sig = signPayload(payload, ctx.privateKey);
  return {
    ...contract,
    adapterManifestSignature: sig,
    adapterManifestSignatureVersion: 'adapter-manifest-sig-v1',
    adapterManifestSigningKeyId: ctx.signingKeyId,
    adapterManifestSigningAlgorithm: ctx.signingAlgorithm,
    adapterManifestSignatureStatus: 'signed',
    adapterManifestSignatureValid: verifyPayload(payload, sig, ctx.publicKey),
    adapterManifestVerificationScope: 'adapter-manifest-core'
  };
}

export async function signComplianceVerdict(verdict) {
  const ctx = await getSigningContext();
  const payload = {
    verdictId: verdict.verdictId,
    targetRef: verdict.targetRef,
    policyProfile: verdict.policyProfile,
    overallVerdict: verdict.overallVerdict,
    admissionDecision: verdict.admissionDecision,
    blockingReasons: verdict.blockingReasons,
    warnings: verdict.warnings,
    verifiedAt: verdict.verifiedAt,
    verifierPackageId: verdict.verifierPackageId,
    latestAttestationSnapshotId: verdict.latestAttestationSnapshotId,
    latestAttestationTrustPublicationId: verdict.latestAttestationTrustPublicationId,
    policyManifest: verdict.policyManifest
  };

  if (!ctx.enabled) {
    return {
      ...verdict,
      complianceVerdictSignature: null,
      complianceVerdictSignatureVersion: 'compliance-verdict-sig-v1',
      complianceVerdictSigningKeyId: null,
      complianceVerdictSigningAlgorithm: 'RSA-SHA256',
      complianceVerdictSignatureStatus: 'unsigned',
      complianceVerdictSignatureValid: null,
      complianceVerdictVerificationScope: 'compliance-verdict-core',
      unsignedReason: ctx.unsignedReason || 'missing_key'
    };
  }

  const sig = signPayload(payload, ctx.privateKey);
  return {
    ...verdict,
    complianceVerdictSignature: sig,
    complianceVerdictSignatureVersion: 'compliance-verdict-sig-v1',
    complianceVerdictSigningKeyId: ctx.signingKeyId,
    complianceVerdictSigningAlgorithm: ctx.signingAlgorithm,
    complianceVerdictSignatureStatus: 'signed',
    complianceVerdictSignatureValid: verifyPayload(payload, sig, ctx.publicKey),
    complianceVerdictVerificationScope: 'compliance-verdict-core'
  };
}

export async function signAdmissionCertificate(cert) {
  const ctx = await getSigningContext();
  const payload = {
    admissionCertificateId: cert.admissionCertificateId,
    createdAt: cert.createdAt,
    certificateVersion: cert.certificateVersion,
    targetRef: cert.targetRef,
    adapterType: cert.adapterType,
    orchestrationProfile: cert.orchestrationProfile,
    verifierPackageId: cert.verifierPackageId,
    externalVerifierProfileId: cert.externalVerifierProfileId,
    renderAdapterContractId: cert.renderAdapterContractId,
    overallVerdict: cert.overallVerdict,
    admissionDecision: cert.admissionDecision,
    blockingReasons: cert.blockingReasons,
    warnings: cert.warnings,
    trustRefs: cert.trustRefs,
    readinessDigest: cert.readinessDigest
  };

  if (!ctx.enabled) {
    return {
      ...cert,
      certificateSignature: null,
      certificateSignatureVersion: 'admission-certificate-sig-v1',
      certificateSigningKeyId: null,
      certificateSigningAlgorithm: 'RSA-SHA256',
      certificateSignatureStatus: 'unsigned',
      certificateSignatureValid: null,
      unsignedReason: ctx.unsignedReason || 'missing_key'
    };
  }

  const sig = signPayload(payload, ctx.privateKey);
  return {
    ...cert,
    certificateSignature: sig,
    certificateSignatureVersion: 'admission-certificate-sig-v1',
    certificateSigningKeyId: ctx.signingKeyId,
    certificateSigningAlgorithm: ctx.signingAlgorithm,
    certificateSignatureStatus: 'signed',
    certificateSignatureValid: verifyPayload(payload, sig, ctx.publicKey)
  };
}

export async function verifyHandoffArtifact(type, artifact) {
  const ctx = await getSigningContext();
  if (!artifact || typeof artifact !== 'object') return { status: 'malformed_handoff', reasonCodes: ['missing_artifact'] };
  if (!ctx.enabled) return { status: 'unsigned', reasonCodes: ['missing_verifier_key'] };

  if (type === 'adapter_manifest') {
    if (!artifact.adapterManifestSignature) return { status: 'unsigned', reasonCodes: ['missing_signature'] };
    const payload = {
      renderAdapterContractId: artifact.renderAdapterContractId,
      contractVersion: artifact.contractVersion,
      adapterType: artifact.adapterType,
      orchestrationProfile: artifact.orchestrationProfile,
      sourceRefs: artifact.sourceRefs,
      readinessState: artifact.readinessState,
      executionPlan: artifact.executionPlan,
      inputArtifacts: artifact.inputArtifacts,
      outputTargets: artifact.outputTargets,
      policyEvaluation: artifact.policyEvaluation
    };
    const ok = verifyPayload(payload, artifact.adapterManifestSignature, ctx.publicKey);
    return { status: ok ? 'verified' : 'invalid_signature', reasonCodes: ok ? ['signature_verified'] : ['signature_verification_failed'] };
  }

  if (type === 'compliance_verdict') {
    if (!artifact.complianceVerdictSignature) return { status: 'unsigned', reasonCodes: ['missing_signature'] };
    const payload = {
      verdictId: artifact.verdictId,
      targetRef: artifact.targetRef,
      policyProfile: artifact.policyProfile,
      overallVerdict: artifact.overallVerdict,
      admissionDecision: artifact.admissionDecision,
      blockingReasons: artifact.blockingReasons,
      warnings: artifact.warnings,
      verifiedAt: artifact.verifiedAt,
      verifierPackageId: artifact.verifierPackageId,
      latestAttestationSnapshotId: artifact.latestAttestationSnapshotId,
      latestAttestationTrustPublicationId: artifact.latestAttestationTrustPublicationId,
      policyManifest: artifact.policyManifest
    };
    const ok = verifyPayload(payload, artifact.complianceVerdictSignature, ctx.publicKey);
    return { status: ok ? 'verified' : 'invalid_signature', reasonCodes: ok ? ['signature_verified'] : ['signature_verification_failed'] };
  }

  if (type === 'signed_certificate') {
    if (!artifact.certificateSignature) return { status: 'unsigned', reasonCodes: ['missing_signature'] };
    const payload = {
      admissionCertificateId: artifact.admissionCertificateId,
      createdAt: artifact.createdAt,
      certificateVersion: artifact.certificateVersion,
      targetRef: artifact.targetRef,
      adapterType: artifact.adapterType,
      orchestrationProfile: artifact.orchestrationProfile,
      verifierPackageId: artifact.verifierPackageId,
      externalVerifierProfileId: artifact.externalVerifierProfileId,
      renderAdapterContractId: artifact.renderAdapterContractId,
      overallVerdict: artifact.overallVerdict,
      admissionDecision: artifact.admissionDecision,
      blockingReasons: artifact.blockingReasons,
      warnings: artifact.warnings,
      trustRefs: artifact.trustRefs,
      readinessDigest: artifact.readinessDigest
    };
    const ok = verifyPayload(payload, artifact.certificateSignature, ctx.publicKey);
    return { status: ok ? 'verified' : 'invalid_signature', reasonCodes: ok ? ['signature_verified'] : ['signature_verification_failed'] };
  }

  return { status: 'malformed_handoff', reasonCodes: ['unsupported_handoff_type'] };
}
