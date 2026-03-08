import { mapRenderAdapterToProvider } from './providerMappingService.js';

export function buildProviderManifest({ renderAdapterContract, providerType, providerProfileId = 'default' }) {
  const mapped = mapRenderAdapterToProvider({ renderAdapterContract, providerType, providerProfileId });
  if (mapped.error) return mapped;

  const { providerProfile, blockingReasons, warnings } = mapped;
  const readinessState = blockingReasons.length
    ? (blockingReasons.includes('unsupported_output_target') ? 'unsupported_output_target' : 'blocked')
    : (warnings.length ? 'ready_with_warnings' : 'ready');

  const providerManifest = {
    manifestType: 'provider_execution_manifest',
    manifestVersion: 'v1',
    providerType,
    providerProfileId,
    sourceRenderAdapterContractId: renderAdapterContract.renderAdapterContractId,
    executionStages: mapped.mapped.executionStages,
    executionJobs: mapped.mapped.executionJobs,
    inputArtifactMap: mapped.mapped.inputArtifactMap,
    outputTargetMap: mapped.mapped.outputTargetMap,
    timingHints: mapped.mapped.timingHints,
    capabilityMappingSummary: mapped.mapped.capabilityMappingSummary,
    policySummary: {
      orchestrationProfile: renderAdapterContract.orchestrationProfile,
      readinessState,
      blockingReasons,
      warnings
    },
    trustRefs: {
      sourceRefs: renderAdapterContract.sourceRefs,
      policyEvaluation: renderAdapterContract.policyEvaluation
    },
    metadata: { deterministic: true }
  };

  return { providerManifest, providerProfile, readinessState, blockingReasons, warnings };
}

export function validateProviderManifestShape(providerManifest) {
  if (!providerManifest || typeof providerManifest !== 'object') return { status: 'malformed_provider_manifest', reasonCodes: ['missing_manifest'] };

  const required = [
    'manifestType', 'manifestVersion', 'providerType', 'providerProfileId', 'sourceRenderAdapterContractId',
    'executionStages', 'executionJobs', 'inputArtifactMap', 'outputTargetMap', 'capabilityMappingSummary', 'policySummary', 'trustRefs'
  ];
  const missing = required.filter((k) => providerManifest[k] === undefined);
  if (missing.length) return { status: 'malformed_provider_manifest', reasonCodes: ['missing_required_fields'], missingFields: missing };

  if (!Array.isArray(providerManifest.executionStages) || !Array.isArray(providerManifest.executionJobs)) {
    return { status: 'malformed_provider_manifest', reasonCodes: ['invalid_execution_arrays'] };
  }

  return { status: 'valid', reasonCodes: ['manifest_shape_valid'] };
}
