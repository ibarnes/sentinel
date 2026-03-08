export function deriveComplianceVerdict({ policySummary, domainChecks = {} }) {
  const blockingReasons = [...(policySummary?.blockingReasons || [])];
  const warnings = [...(policySummary?.warnings || [])];

  if (domainChecks.attestationTrustPublicationStatus === 'missing_publication') blockingReasons.push('attestation_trust_publication_missing');
  if (domainChecks.attestationTrustPublicationStatus === 'chain_head_mismatch') blockingReasons.push('attestation_chain_head_digest_missing');
  if (domainChecks.attestationTrustPublicationStatus === 'invalid_signature') blockingReasons.push('attestation_trust_publication_invalid');

  if (domainChecks.policyManifestStatus === 'manifest_missing') blockingReasons.push('policy_manifest_missing');
  if (domainChecks.policyManifestStatus === 'invalid_signature') blockingReasons.push('policy_manifest_signature_invalid');
  if (domainChecks.policyManifestStatus === 'version_incompatible') blockingReasons.push('policy_manifest_version_incompatible');
  if (domainChecks.policyManifestStatus === 'unsigned' && policySummary?.orchestrationPolicyProfile === 'production_verified') blockingReasons.push('policy_manifest_signature_missing');

  let overallVerdict = 'admit';
  let admissionDecision = 'admit';
  if (blockingReasons.length) {
    overallVerdict = 'deny';
    admissionDecision = 'deny';
    if (blockingReasons.some((r) => String(r).includes('missing'))) overallVerdict = 'missing_required_artifact';
    else if (blockingReasons.some((r) => String(r).includes('integrity'))) overallVerdict = 'integrity_failed';
    else if (blockingReasons.some((r) => String(r).includes('signature'))) overallVerdict = 'signature_failed';
    else overallVerdict = 'policy_failed';
  } else if (warnings.length) {
    overallVerdict = 'admit_with_warnings';
    admissionDecision = 'admit_with_warnings';
  }

  return { overallVerdict, admissionDecision, blockingReasons: [...new Set(blockingReasons)], warnings: [...new Set(warnings)] };
}
