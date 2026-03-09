export const CALLBACK_POLICY_PROFILES = {
  dev: {
    callbackPolicyProfile: 'dev',
    replayWindowSeconds: 3600,
    allowUnsigned: true,
    requireSignatureByCallbackType: [],
    requireKeyRegistryForSigned: false,
    allowRetiredKeys: true,
    allowRevokedKeys: false,
    duplicateDecision: 'ignore',
    conflictingReplayDecision: 'warn'
  },
  internal_verified: {
    callbackPolicyProfile: 'internal_verified',
    replayWindowSeconds: 1800,
    allowUnsigned: true,
    requireSignatureByCallbackType: ['execution_completed', 'execution_failed'],
    requireKeyRegistryForSigned: true,
    allowRetiredKeys: true,
    allowRevokedKeys: false,
    duplicateDecision: 'ignore',
    conflictingReplayDecision: 'block'
  },
  production_verified: {
    callbackPolicyProfile: 'production_verified',
    replayWindowSeconds: 900,
    allowUnsigned: false,
    requireSignatureByCallbackType: ['provider_acknowledged','execution_started','execution_progress','execution_completed','execution_failed','execution_rejected','execution_canceled','execution_expired'],
    requireKeyRegistryForSigned: true,
    allowRetiredKeys: false,
    allowRevokedKeys: false,
    duplicateDecision: 'block',
    conflictingReplayDecision: 'block'
  }
};

export function getCallbackPolicyProfile(name = 'dev') {
  return CALLBACK_POLICY_PROFILES[name] || CALLBACK_POLICY_PROFILES.dev;
}

export function evaluateCallbackPolicy({ policyProfile = 'dev', callbackType, trustValidationStatus, keyRegistryStatus, replayStatus }) {
  const policy = getCallbackPolicyProfile(policyProfile);
  const blockingReasons = [];
  const warnings = [];

  const requiresSignature = policy.requireSignatureByCallbackType.includes(callbackType);
  if (requiresSignature && ['unsigned_allowed','unsigned'].includes(trustValidationStatus)) blockingReasons.push('signature_required_by_policy');
  if (!policy.allowUnsigned && ['unsigned_allowed','unsigned'].includes(trustValidationStatus)) blockingReasons.push('unsigned_not_allowed');

  if (policy.requireKeyRegistryForSigned && ['resolved','retired_signing_key','revoked_signing_key','unknown_signing_key'].includes(keyRegistryStatus) === false) {
    blockingReasons.push('key_registry_resolution_required');
  }
  if (keyRegistryStatus === 'revoked_signing_key' && !policy.allowRevokedKeys) blockingReasons.push('revoked_key_disallowed');
  if (keyRegistryStatus === 'retired_signing_key' && !policy.allowRetiredKeys) blockingReasons.push('retired_key_disallowed');

  if (replayStatus === 'duplicate_within_window') {
    if (policy.duplicateDecision === 'block') blockingReasons.push('duplicate_replay_blocked');
    else warnings.push('duplicate_replay_ignored');
  }
  if (replayStatus === 'conflicting_replay') {
    if (policy.conflictingReplayDecision === 'block') blockingReasons.push('conflicting_replay_blocked');
    else warnings.push('conflicting_replay_allowed_with_warning');
  }

  const replayDecision = blockingReasons.some((r) => r.includes('replay')) ? 'block' : (replayStatus === 'duplicate_within_window' ? 'idempotent_ignore' : 'apply');
  const decision = blockingReasons.length ? 'block' : (replayDecision === 'idempotent_ignore' ? 'ignore' : 'apply');

  return {
    callbackPolicyProfile: policy.callbackPolicyProfile,
    policyEvaluationResult: decision,
    replayDecision,
    replayWindowPolicy: { windowSeconds: policy.replayWindowSeconds, duplicateDecision: policy.duplicateDecision, conflictingReplayDecision: policy.conflictingReplayDecision },
    blockingReasons,
    warnings
  };
}
