import crypto from 'crypto';
import { resolveCallbackSigningKey } from './callbackKeyRegistryService.js';
import { normalizeResultArtifactPayload, artifactPayloadDigest } from './resultArtifactNormalizationService.js';

function trustOut({ artifactSignatureStatus, artifactSignatureValid, artifactSigningKeyId = null, artifactSigningAlgorithm = 'HMAC-SHA256', artifactOriginStatus, artifactDigest, keyRegistryStatus = 'not_evaluated', warnings = [] }) {
  return {
    artifactSignatureStatus,
    artifactSignatureValid,
    artifactSigningKeyId,
    artifactSigningAlgorithm,
    artifactVerificationScope: 'result-artifact-payload-core',
    trustProfile: 'external_result_artifact_v1',
    artifactOriginStatus,
    artifactDigest,
    artifactDigestVersion: 'sha256-v1',
    keyRegistryStatus,
    warnings
  };
}

export async function verifyResultArtifact({ providerType, providerProfileId = 'default', artifactType, artifactPayload, trustMetadata = {}, artifactDigest = null, policyProfile = 'dev' }) {
  const normalized = normalizeResultArtifactPayload({ providerType, providerProfileId, artifactType, artifactPayload });
  if (normalized.error) {
    const map = { malformed_artifact: 'malformed_artifact', unsupported_artifact_type: 'unsupported_artifact_type', capability_mismatch: 'capability_mismatch' };
    return { status: map[normalized.error] || 'malformed_artifact', structuralValidationStatus: map[normalized.error] || 'malformed_artifact', trustValidationStatus: 'not_evaluated', trust: null, reasonCodes: normalized.reasonCodes || [normalized.error], warnings: [] };
  }

  const digest = artifactDigest || artifactPayloadDigest(normalized.normalizedPayload);
  const signature = trustMetadata?.artifactSignature || null;
  const keyId = trustMetadata?.artifactSigningKeyId || null;
  const algo = trustMetadata?.artifactSigningAlgorithm || 'HMAC-SHA256';
  const allowUnsigned = Boolean(trustMetadata?.unsignedAllowed) || policyProfile === 'dev';

  if (!signature) {
    if (allowUnsigned) {
      const trust = trustOut({ artifactSignatureStatus: 'unsigned', artifactSignatureValid: true, artifactOriginStatus: 'unsigned', artifactDigest: digest, warnings: ['unsigned_artifact_allowed_by_policy'] });
      return { status: 'valid_with_warnings', structuralValidationStatus: 'valid', trustValidationStatus: 'unsigned_allowed', trust, reasonCodes: ['artifact_shape_valid'], warnings: trust.warnings };
    }
    const trust = trustOut({ artifactSignatureStatus: 'unsigned', artifactSignatureValid: false, artifactOriginStatus: 'unsigned', artifactDigest: digest, warnings: ['unsigned_artifact_not_allowed'] });
    return { status: 'capability_mismatch', structuralValidationStatus: 'valid', trustValidationStatus: 'unsigned_not_allowed', trust, reasonCodes: ['artifact_trust_verification_failed'], warnings: trust.warnings };
  }

  const keyRes = await resolveCallbackSigningKey({ callbackSigningKeyId: keyId, providerType, providerProfileId });
  if (keyRes.status !== 'resolved') {
    const origin = keyRes.status === 'unknown_signing_key' ? 'unknown_origin' : 'invalid_signature';
    const trust = trustOut({ artifactSignatureStatus: 'invalid_signature', artifactSignatureValid: false, artifactSigningKeyId: keyId, artifactSigningAlgorithm: algo, artifactOriginStatus: origin, artifactDigest: digest, keyRegistryStatus: keyRes.status, warnings: [keyRes.status] });
    return { status: keyRes.status === 'unknown_signing_key' ? 'capability_mismatch' : 'invalid_signature', structuralValidationStatus: 'valid', trustValidationStatus: keyRes.status, trust, reasonCodes: ['artifact_trust_verification_failed'], warnings: trust.warnings };
  }

  const key = keyRes.key;
  if (String(key.algorithm).toUpperCase() !== String(algo).toUpperCase()) {
    const trust = trustOut({ artifactSignatureStatus: 'invalid_signature', artifactSignatureValid: false, artifactSigningKeyId: keyId, artifactSigningAlgorithm: algo, artifactOriginStatus: 'invalid_signature', artifactDigest: digest, keyRegistryStatus: 'algorithm_mismatch', warnings: ['algorithm_mismatch'] });
    return { status: 'invalid_signature', structuralValidationStatus: 'valid', trustValidationStatus: 'algorithm_mismatch', trust, reasonCodes: ['artifact_trust_verification_failed'], warnings: trust.warnings };
  }

  const mac = crypto.createHmac('sha256', key.secret).update(JSON.stringify(normalized.normalizedPayload)).digest('hex');
  const sig = String(signature);
  const valid = sig.length === mac.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
  if (!valid) {
    const trust = trustOut({ artifactSignatureStatus: 'invalid_signature', artifactSignatureValid: false, artifactSigningKeyId: keyId, artifactSigningAlgorithm: algo, artifactOriginStatus: 'invalid_signature', artifactDigest: digest, keyRegistryStatus: 'resolved', warnings: ['invalid_signature'] });
    return { status: 'invalid_signature', structuralValidationStatus: 'valid', trustValidationStatus: 'invalid_signature', trust, reasonCodes: ['artifact_trust_verification_failed'], warnings: trust.warnings };
  }

  const trust = trustOut({ artifactSignatureStatus: 'signed', artifactSignatureValid: true, artifactSigningKeyId: keyId, artifactSigningAlgorithm: algo, artifactOriginStatus: 'trusted', artifactDigest: digest, keyRegistryStatus: 'resolved' });
  return { status: 'valid', structuralValidationStatus: 'valid', trustValidationStatus: 'valid', trust, reasonCodes: ['artifact_shape_valid','artifact_trust_verified'], warnings: [] };
}
