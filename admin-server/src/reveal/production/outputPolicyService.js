export const OUTPUT_POLICY_PROFILES = {
  dev: {
    policyProfileId: 'dev',
    requireSignedResultArtifact: false,
    requireSignedResultTrustPublication: false,
    requireProducedOutputVerifierPass: false,
    requiredOutputTypesByProvider: {}
  },
  internal_verified: {
    policyProfileId: 'internal_verified',
    requireSignedResultArtifact: false,
    requireSignedResultTrustPublication: true,
    requireProducedOutputVerifierPass: true,
    requiredOutputTypesByProvider: {
      generic_renderer: ['execution_result_summary']
    }
  },
  production_verified: {
    policyProfileId: 'production_verified',
    requireSignedResultArtifact: true,
    requireSignedResultTrustPublication: true,
    requireProducedOutputVerifierPass: true,
    requiredOutputTypesByProvider: {
      generic_renderer: ['execution_result_summary','render_manifest_output']
    }
  }
};

export function getOutputPolicyProfile(policyProfileId = 'dev') {
  return OUTPUT_POLICY_PROFILES[policyProfileId] || OUTPUT_POLICY_PROFILES.dev;
}
