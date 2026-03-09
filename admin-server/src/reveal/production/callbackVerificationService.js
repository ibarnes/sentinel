import crypto from 'crypto';
import { resolveCallbackSigningKey } from './callbackKeyRegistryService.js';
import { getCallbackPolicyProfile } from './callbackPolicyService.js';

export const CALLBACK_TYPES = [
  'handoff_acknowledged','provider_acknowledged','execution_started','execution_progress','execution_completed','execution_failed','execution_rejected','execution_canceled','execution_expired','provider_note'
];

const baseMatrix = {
  requiredFieldsByCallbackType: {
    handoff_acknowledged: ['status','eventAt'],
    provider_acknowledged: ['status','eventAt'],
    execution_started: ['status','eventAt'],
    execution_progress: ['status','eventAt'],
    execution_completed: ['status','eventAt','resultSummary'],
    execution_failed: ['status','eventAt','errorCode'],
    execution_rejected: ['status','eventAt','errorCode'],
    execution_canceled: ['status','eventAt'],
    execution_expired: ['status','eventAt'],
    provider_note: ['status','eventAt','message']
  },
  optionalFieldsByCallbackType: {
    provider_acknowledged: ['message','resultSummary','progressPercent'],
    execution_progress: ['message','progressPercent','eventMetadata'],
    execution_completed: ['result','message','eventMetadata'],
    execution_failed: ['message','result','eventMetadata'],
    provider_note: ['eventMetadata']
  },
  forbiddenFieldsByCallbackType: {
    provider_acknowledged: ['errorCode'],
    execution_completed: ['errorCode'],
    execution_started: ['resultSummary'],
    execution_progress: ['resultSummary']
  },
  requiredTrustFieldsByCallbackType: {
    provider_acknowledged: ['callbackSigningKeyId'],
    execution_completed: ['callbackSigningKeyId'],
    execution_failed: ['callbackSigningKeyId']
  },
  supportedStatusValuesByCallbackType: {
    handoff_acknowledged: ['accepted','queued'],
    provider_acknowledged: ['accepted','queued'],
    execution_started: ['started'],
    execution_progress: ['progress','running'],
    execution_completed: ['completed','success'],
    execution_failed: ['failed','error'],
    execution_rejected: ['rejected'],
    execution_canceled: ['canceled'],
    execution_expired: ['expired'],
    provider_note: ['note']
  }
};

export const PROVIDER_CALLBACK_SCHEMAS = {
  generic_renderer: { default: providerSchema('generic_renderer/default') },
  subtitle_compositor: { default: providerSchema('subtitle_compositor/default') },
  narration_pipeline: { default: providerSchema('narration_pipeline/default') },
  scene_compositor: { default: providerSchema('scene_compositor/default') },
  storyboard_exporter: { default: providerSchema('storyboard_exporter/default') }
};

function providerSchema(profile) {
  return {
    profile,
    acceptedCallbackTypes: [...CALLBACK_TYPES],
    ...baseMatrix
  };
}

export function canonicalizeCallbackValue(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalizeCallbackValue);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (['transportId','requestId','headers','receivedAt'].includes(k)) continue;
      const cv = canonicalizeCallbackValue(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

export function callbackPayloadDigest(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalizeCallbackValue(payload))).digest('hex');
}

function getProfile(providerType, providerProfileId = 'default') {
  return PROVIDER_CALLBACK_SCHEMAS[providerType]?.[providerProfileId] || null;
}

function validateFieldMatrix({ profile, callbackType, callbackPayload, trustMetadata }) {
  const missing = (profile.requiredFieldsByCallbackType?.[callbackType] || []).filter((f) => callbackPayload?.[f] === undefined);
  if (missing.length) return { status: 'malformed_callback', reasonCodes: ['missing_required_fields_by_callback_type'], missingFields: missing };

  const forbidden = (profile.forbiddenFieldsByCallbackType?.[callbackType] || []).filter((f) => callbackPayload?.[f] !== undefined);
  if (forbidden.length) return { status: 'malformed_callback', reasonCodes: ['forbidden_fields_present'], forbiddenFields: forbidden };

  const requiredTrust = (profile.requiredTrustFieldsByCallbackType?.[callbackType] || []).filter((f) => trustMetadata?.[f] == null || trustMetadata?.[f] === '');
  if (requiredTrust.length) return { status: 'malformed_callback', reasonCodes: ['missing_required_trust_fields'], missingTrustFields: requiredTrust };

  const supportedStatus = profile.supportedStatusValuesByCallbackType?.[callbackType] || [];
  if (supportedStatus.length && callbackPayload?.status != null && !supportedStatus.includes(String(callbackPayload.status))) {
    return { status: 'malformed_callback', reasonCodes: ['unsupported_status_value'], supportedStatusValues: supportedStatus };
  }
  return { status: 'valid', reasonCodes: ['field_matrix_valid'] };
}

export function verifyExecutionCallbackShape({ providerType, providerProfileId = 'default', callbackType, callbackPayload, trustMetadata = {} }) {
  const profile = getProfile(providerType, providerProfileId);
  if (!providerType || !providerProfileId) return { status: 'malformed_callback', reasonCodes: ['missing_provider_profile'], profile: null };
  if (!profile) return { status: 'capability_mismatch', reasonCodes: ['unsupported_provider_profile'], profile: null };
  if (!CALLBACK_TYPES.includes(callbackType)) return { status: 'unsupported_callback_type', reasonCodes: ['unsupported_callback_type'], profile };
  if (!profile.acceptedCallbackTypes.includes(callbackType)) return { status: 'unsupported_callback_type', reasonCodes: ['profile_callback_type_mismatch'], profile };
  if (!callbackPayload || typeof callbackPayload !== 'object' || Array.isArray(callbackPayload)) return { status: 'malformed_callback', reasonCodes: ['missing_callback_payload'], profile };
  const matrix = validateFieldMatrix({ profile, callbackType, callbackPayload, trustMetadata });
  if (matrix.status !== 'valid') return { ...matrix, profile };
  return { status: 'valid', reasonCodes: ['callback_shape_valid'], profile };
}

export async function verifyCallbackTrust({ providerType, providerProfileId = 'default', callbackType, callbackPayload, trustMetadata = {}, callbackDigest, callbackPolicyProfile = 'dev' }) {
  const normalizedDigest = callbackDigest || callbackPayloadDigest(callbackPayload);
  const signature = trustMetadata?.callbackSignature || null;
  const algorithm = trustMetadata?.callbackSigningAlgorithm || 'HMAC-SHA256';
  const keyId = trustMetadata?.callbackSigningKeyId || null;
  const policy = getCallbackPolicyProfile(callbackPolicyProfile);

  if (!signature) {
    if (policy.allowUnsigned || trustMetadata?.unsignedAllowed) return trustOut('unsigned_allowed', true, 'unsigned', normalizedDigest, algorithm, 'not_applicable', keyId, ['unsigned_callback_allowed']);
    return trustOut('unsigned', false, 'unsigned', normalizedDigest, algorithm, 'not_applicable', keyId, ['unsigned_callback_not_allowed']);
  }

  const keyResolution = await resolveCallbackSigningKey({ callbackSigningKeyId: keyId, providerType, providerProfileId });
  if (keyResolution.status === 'malformed_signing_key_id') return trustOut('invalid_signature', false, 'unknown_origin', normalizedDigest, algorithm, 'malformed_signing_key_id', keyId, ['malformed_signing_key_id']);
  if (keyResolution.status === 'unknown_signing_key') return trustOut('invalid_signature', false, 'unknown_origin', normalizedDigest, algorithm, 'unknown_signing_key', keyId, ['unknown_signing_key']);
  if (keyResolution.status === 'revoked_signing_key') return trustOut('invalid_signature', false, 'invalid_signature', normalizedDigest, algorithm, 'revoked_signing_key', keyId, ['revoked_signing_key']);
  if (keyResolution.status === 'retired_signing_key' && !policy.allowRetiredKeys) return trustOut('invalid_signature', false, 'invalid_signature', normalizedDigest, algorithm, 'retired_signing_key', keyId, ['retired_signing_key_disallowed']);

  const key = keyResolution.key;
  if (String(key.algorithm || '').toUpperCase() !== String(algorithm || '').toUpperCase()) {
    return trustOut('invalid_signature', false, 'invalid_signature', normalizedDigest, algorithm, 'algorithm_mismatch', keyId, ['algorithm_mismatch']);
  }

  const mac = crypto.createHmac('sha256', key.secret).update(JSON.stringify(canonicalizeCallbackValue(callbackPayload))).digest('hex');
  const sig = String(signature);
  const valid = sig.length === mac.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
  if (!valid) return trustOut('invalid_signature', false, 'invalid_signature', normalizedDigest, algorithm, keyResolution.status, keyId, ['invalid_signature']);
  return trustOut('signed', true, 'trusted', normalizedDigest, algorithm, keyResolution.status, keyId, []);
}

function trustOut(callbackSignatureStatus, callbackSignatureValid, callbackOriginStatus, callbackDigest, callbackSigningAlgorithm, keyRegistryStatus, matchedCallbackSigningKeyId, warnings = []) {
  return {
    callbackSignatureStatus,
    callbackSignatureValid,
    callbackSigningAlgorithm,
    callbackOriginStatus,
    callbackDigest,
    callbackDigestVersion: 'sha256-v1',
    callbackVerificationScope: 'callback-payload-core',
    trustProfile: 'external_callback_v1',
    keyRegistryStatus,
    matchedCallbackSigningKeyId,
    warnings
  };
}

export async function verifyExecutionCallback({ providerType, providerProfileId = 'default', callbackType, callbackPayload, trustMetadata = {}, callbackDigest = null, callbackPolicyProfile = 'dev' }) {
  const shape = verifyExecutionCallbackShape({ providerType, providerProfileId, callbackType, callbackPayload, trustMetadata });
  if (shape.status !== 'valid') return {
    status: shape.status,
    structuralValidationStatus: shape.status,
    trustValidationStatus: 'not_evaluated',
    reasonCodes: shape.reasonCodes || [],
    warnings: [],
    trust: null,
    profile: shape.profile || null
  };

  const trust = await verifyCallbackTrust({ providerType, providerProfileId, callbackType, callbackPayload, trustMetadata, callbackDigest, callbackPolicyProfile });
  const trustValidationStatus = trust.callbackSignatureValid ? (trust.callbackSignatureStatus === 'unsigned_allowed' ? 'unsigned_allowed' : 'valid') : (trust.keyRegistryStatus || 'invalid_signature');
  const warnings = [...(trust.warnings || [])];
  const status = trust.callbackSignatureValid ? (warnings.length ? 'valid_with_warnings' : 'valid') : (trustValidationStatus === 'invalid_signature' ? 'invalid_signature' : 'capability_mismatch');

  return {
    status,
    structuralValidationStatus: 'valid',
    trustValidationStatus,
    reasonCodes: trust.callbackSignatureValid ? ['callback_shape_valid','callback_trust_verified'] : ['callback_trust_verification_failed'],
    warnings,
    trust,
    profile: shape.profile
  };
}
