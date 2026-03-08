import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';

export const ATTESTATION_SIG_VERSION = 'attestation-sig-v1';
export const BUNDLE_MANIFEST_SIG_VERSION = 'attestation-bundle-manifest-sig-v1';

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

export async function signAttestationReport(attestationReport) {
  const ctx = await getSigningContext();
  const payload = {
    attestationReportId: attestationReport.attestationReportId,
    verifierPackageId: attestationReport.verifierPackageId,
    createdAt: attestationReport.createdAt,
    policyProfile: attestationReport.policyProfile,
    overallVerificationStatus: attestationReport.overallVerificationStatus,
    blockingReasons: attestationReport.blockingReasons,
    warnings: attestationReport.warnings,
    attestationDigest: attestationReport.attestationDigest
  };

  if (!ctx.enabled) {
    return {
      attestationSignature: null,
      attestationSignatureVersion: ATTESTATION_SIG_VERSION,
      attestationSigningKeyId: null,
      attestationSigningAlgorithm: 'RSA-SHA256',
      attestationSignatureStatus: 'unsigned',
      attestationVerificationScope: 'attestation-report-core',
      attestationSignatureValid: null,
      unsignedReason: ctx.unsignedReason || 'missing_key'
    };
  }

  const signature = signPayload(payload, ctx.privateKey);
  const valid = verifyPayload(payload, signature, ctx.publicKey);
  return {
    attestationSignature: signature,
    attestationSignatureVersion: ATTESTATION_SIG_VERSION,
    attestationSigningKeyId: ctx.signingKeyId,
    attestationSigningAlgorithm: ctx.signingAlgorithm,
    attestationSignatureStatus: 'signed',
    attestationVerificationScope: 'attestation-report-core',
    attestationSignatureValid: valid,
    signerMetadata: { signerKeyFingerprint: ctx.signerKeyFingerprint, publicKeyHint: ctx.publicKeyHint }
  };
}

export async function signBundleManifest(manifest) {
  const ctx = await getSigningContext();
  const payload = {
    bundleType: manifest.bundleType,
    bundleVersion: manifest.bundleVersion,
    verifierPackageId: manifest.verifierPackageId,
    createdAt: manifest.createdAt,
    files: manifest.files
  };

  if (!ctx.enabled) {
    return {
      bundleManifestSignature: null,
      bundleManifestSignatureVersion: BUNDLE_MANIFEST_SIG_VERSION,
      bundleManifestSigningKeyId: null,
      bundleManifestSigningAlgorithm: 'RSA-SHA256',
      bundleManifestSignatureStatus: 'unsigned',
      bundleManifestSignatureValid: null,
      unsignedReason: ctx.unsignedReason || 'missing_key'
    };
  }

  const signature = signPayload(payload, ctx.privateKey);
  const valid = verifyPayload(payload, signature, ctx.publicKey);
  return {
    bundleManifestSignature: signature,
    bundleManifestSignatureVersion: BUNDLE_MANIFEST_SIG_VERSION,
    bundleManifestSigningKeyId: ctx.signingKeyId,
    bundleManifestSigningAlgorithm: ctx.signingAlgorithm,
    bundleManifestSignatureStatus: 'signed',
    bundleManifestSignatureValid: valid,
    signerMetadata: { signerKeyFingerprint: ctx.signerKeyFingerprint, publicKeyHint: ctx.publicKeyHint }
  };
}

export async function verifyAttestationSignature(attestationReport) {
  const ctx = await getSigningContext();
  if (!attestationReport?.attestationSignature) return { status: 'unsigned', valid: null };
  if (!ctx.enabled) return { status: 'unsigned', valid: null, reason: 'missing_verifier_key' };

  const payload = {
    attestationReportId: attestationReport.attestationReportId,
    verifierPackageId: attestationReport.verifierPackageId,
    createdAt: attestationReport.createdAt,
    policyProfile: attestationReport.policyProfile,
    overallVerificationStatus: attestationReport.overallVerificationStatus,
    blockingReasons: attestationReport.blockingReasons,
    warnings: attestationReport.warnings,
    attestationDigest: attestationReport.attestationDigest
  };
  const ok = verifyPayload(payload, attestationReport.attestationSignature, ctx.publicKey);
  return { status: ok ? 'verified' : 'invalid_signature', valid: ok };
}

export async function verifyBundleManifestSignature(bundleManifest) {
  const ctx = await getSigningContext();
  if (!bundleManifest?.bundleManifestSignature) return { status: 'unsigned', valid: null };
  if (!ctx.enabled) return { status: 'unsigned', valid: null, reason: 'missing_verifier_key' };

  const payload = {
    bundleType: bundleManifest.bundleType,
    bundleVersion: bundleManifest.bundleVersion,
    verifierPackageId: bundleManifest.verifierPackageId,
    createdAt: bundleManifest.createdAt,
    files: bundleManifest.files
  };
  const ok = verifyPayload(payload, bundleManifest.bundleManifestSignature, ctx.publicKey);
  return { status: ok ? 'verified' : 'invalid_signature', valid: ok };
}
