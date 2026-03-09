import crypto from 'crypto';

export const CALLBACK_TYPES = [
  'handoff_acknowledged','provider_acknowledged','execution_started','execution_progress','execution_completed','execution_failed','execution_rejected','execution_canceled','execution_expired','provider_note'
];

export const PROVIDER_CALLBACK_SCHEMAS = {
  generic_renderer: { default: schema('generic_renderer/default') },
  subtitle_compositor: { default: schema('subtitle_compositor/default') },
  narration_pipeline: { default: schema('narration_pipeline/default') },
  scene_compositor: { default: schema('scene_compositor/default') },
  storyboard_exporter: { default: schema('storyboard_exporter/default') }
};

function schema(profile) {
  return {
    profile,
    acceptedCallbackTypes: [...CALLBACK_TYPES],
    requiredPayloadFields: ['status', 'eventAt'],
    optionalPayloadFields: ['progressPercent', 'message', 'errorCode', 'result', 'eventMetadata'],
    statusMappings: { accepted: 'provider_acknowledged', started: 'execution_started', progress: 'execution_progress', completed: 'execution_completed', failed: 'execution_failed' },
    signatureTrust: { requiresSignature: false, unsignedAllowed: true, defaultTrustProfile: 'external_callback_v1' }
  };
}

export function canonicalizeCallbackValue(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalizeCallbackValue); // semantic order preserved
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null; // normalized numeric precision
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      if (['transportId','requestId','headers','receivedAt'].includes(k)) continue; // transient transport fields excluded
      const cv = canonicalizeCallbackValue(v[k]);
      if (cv !== undefined) out[k] = cv; // undefined removed; null preserved
    }
    return out;
  }
  return v;
}

export function callbackPayloadDigest(payload) {
  const canonical = canonicalizeCallbackValue(payload);
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function getProfile(providerType, providerProfileId = 'default') {
  return PROVIDER_CALLBACK_SCHEMAS[providerType]?.[providerProfileId] || null;
}

export function verifyExecutionCallbackShape({ providerType, providerProfileId = 'default', callbackType, callbackPayload }) {
  const profile = getProfile(providerType, providerProfileId);
  if (!providerType || !providerProfileId) return { status: 'malformed_callback', reasonCodes: ['missing_provider_profile'], profile: null };
  if (!profile) return { status: 'capability_mismatch', reasonCodes: ['unsupported_provider_profile'], profile: null };
  if (!CALLBACK_TYPES.includes(callbackType)) return { status: 'unsupported_callback_type', reasonCodes: ['unsupported_callback_type'], profile };
  if (!profile.acceptedCallbackTypes.includes(callbackType)) return { status: 'unsupported_callback_type', reasonCodes: ['profile_callback_type_mismatch'], profile };
  if (!callbackPayload || typeof callbackPayload !== 'object' || Array.isArray(callbackPayload)) return { status: 'malformed_callback', reasonCodes: ['missing_callback_payload'], profile };
  const missing = profile.requiredPayloadFields.filter((f) => callbackPayload[f] === undefined);
  if (missing.length) return { status: 'malformed_callback', reasonCodes: ['missing_required_callback_fields'], missingFields: missing, profile };
  return { status: 'valid', reasonCodes: ['callback_shape_valid'], profile };
}

export function verifyCallbackTrust({ callbackPayload, trustMetadata = {}, callbackDigest }) {
  const normalizedDigest = callbackDigest || callbackPayloadDigest(callbackPayload);
  const signature = trustMetadata?.callbackSignature || null;
  const algorithm = trustMetadata?.callbackSigningAlgorithm || 'HMAC-SHA256';
  const signingSecret = trustMetadata?.signingSecret || null;
  const unsignedAllowed = Boolean(trustMetadata?.unsignedAllowed);

  if (!signature) {
    if (unsignedAllowed) return trustOut('unsigned', true, 'unsigned', normalizedDigest, algorithm, ['unsigned_callback_allowed_by_policy']);
    return trustOut('unsigned', false, 'unsigned', normalizedDigest, algorithm, ['unsigned_callback_not_allowed']);
  }
  if (!signingSecret) return trustOut('invalid_signature', false, 'unknown_origin', normalizedDigest, algorithm, ['missing_signing_secret']);

  const mac = crypto.createHmac('sha256', signingSecret).update(JSON.stringify(canonicalizeCallbackValue(callbackPayload))).digest('hex');
  const sig = String(signature);
  const valid = sig.length === mac.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
  if (!valid) return trustOut('invalid_signature', false, 'invalid_signature', normalizedDigest, algorithm, ['signature_mismatch']);
  return trustOut('signed', true, 'trusted', normalizedDigest, algorithm, []);
}

function trustOut(callbackSignatureStatus, callbackSignatureValid, callbackOriginStatus, callbackDigest, callbackSigningAlgorithm, warnings = []) {
  return {
    callbackSignatureStatus,
    callbackSignatureValid,
    callbackSigningAlgorithm,
    callbackOriginStatus,
    callbackDigest,
    callbackDigestVersion: 'sha256-v1',
    callbackVerificationScope: 'callback-payload-core',
    warnings,
    trustProfile: 'external_callback_v1'
  };
}

export function verifyExecutionCallback({ providerType, providerProfileId = 'default', callbackType, callbackPayload, trustMetadata = {}, callbackDigest = null }) {
  const shape = verifyExecutionCallbackShape({ providerType, providerProfileId, callbackType, callbackPayload });
  if (shape.status !== 'valid') return { status: shape.status, reasonCodes: shape.reasonCodes || [], warnings: [], trust: null, profile: shape.profile || null };
  const trust = verifyCallbackTrust({ callbackPayload, trustMetadata, callbackDigest });
  const warnings = [...(trust.warnings || [])];
  if (trust.callbackSignatureStatus === 'unsigned' && trust.callbackSignatureValid) return { status: 'valid_with_warnings', reasonCodes: ['callback_shape_valid'], warnings, trust, profile: shape.profile };
  if (!trust.callbackSignatureValid) return { status: trust.callbackOriginStatus === 'invalid_signature' ? 'invalid_signature' : 'capability_mismatch', reasonCodes: ['callback_trust_verification_failed'], warnings, trust, profile: shape.profile };
  return { status: 'valid', reasonCodes: ['callback_shape_valid','callback_trust_verified'], warnings, trust, profile: shape.profile };
}
