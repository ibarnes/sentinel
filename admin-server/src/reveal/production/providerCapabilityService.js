const CAPABILITY_VERSION = 'v1';

const PROFILES = {
  generic_renderer: {
    default: {
      providerType: 'generic_renderer',
      providerProfileId: 'default',
      supportedInputArtifacts: ['unified_verifier_package', 'reviewed_script', 'voice_track_plan', 'shot_list', 'shot_list_snapshot', 'render_plan'],
      supportedOutputTargets: ['composite_job_manifest', 'assembly_bundle', 'subtitle_track', 'narration_plan', 'storyboard_json', 'edit_decision_list'],
      supportedStageTypes: ['composite_manifest', 'visual_assembly', 'subtitle_generation', 'narration_plan', 'storyboard_assembly'],
      supportedJobTypes: ['composite_manifest', 'visual_assembly', 'subtitle_generation', 'narration_plan', 'storyboard_assembly'],
      requiredFields: ['sourceRenderAdapterContractId', 'executionStages', 'executionJobs', 'inputArtifactMap', 'outputTargetMap'],
      optionalFields: ['timingHints', 'trustRefs', 'metadata'],
      unsupportedFeatures: [],
      capabilityVersion: CAPABILITY_VERSION,
      metadata: { strictUnsupported: false }
    }
  },
  subtitle_compositor: {
    default: {
      providerType: 'subtitle_compositor',
      providerProfileId: 'default',
      supportedInputArtifacts: ['voice_track_plan', 'reviewed_script', 'shot_list'],
      supportedOutputTargets: ['subtitle_track'],
      supportedStageTypes: ['subtitle_generation'],
      supportedJobTypes: ['subtitle_generation'],
      requiredFields: ['outputTargetMap', 'executionStages', 'executionJobs'],
      optionalFields: ['timingHints', 'metadata'],
      unsupportedFeatures: ['composite_manifest', 'storyboard_assembly', 'visual_assembly'],
      capabilityVersion: CAPABILITY_VERSION,
      metadata: { strictUnsupported: true, requiredOutputTypes: ['subtitle_track'] }
    }
  },
  narration_pipeline: {
    default: {
      providerType: 'narration_pipeline',
      providerProfileId: 'default',
      supportedInputArtifacts: ['reviewed_script', 'voice_track_plan', 'shot_list'],
      supportedOutputTargets: ['narration_plan'],
      supportedStageTypes: ['narration_plan'],
      supportedJobTypes: ['narration_plan'],
      requiredFields: ['outputTargetMap', 'executionStages', 'executionJobs'],
      optionalFields: ['timingHints', 'metadata'],
      unsupportedFeatures: ['subtitle_generation', 'composite_manifest', 'visual_assembly', 'storyboard_assembly'],
      capabilityVersion: CAPABILITY_VERSION,
      metadata: { strictUnsupported: true, requiredOutputTypes: ['narration_plan'] }
    }
  },
  scene_compositor: {
    default: {
      providerType: 'scene_compositor',
      providerProfileId: 'default',
      supportedInputArtifacts: ['shot_list', 'shot_list_snapshot', 'render_plan', 'unified_verifier_package'],
      supportedOutputTargets: ['composite_job_manifest', 'assembly_bundle'],
      supportedStageTypes: ['visual_assembly', 'composite_manifest'],
      supportedJobTypes: ['visual_assembly', 'composite_manifest'],
      requiredFields: ['executionStages', 'executionJobs', 'outputTargetMap'],
      optionalFields: ['timingHints', 'metadata'],
      unsupportedFeatures: ['subtitle_generation', 'narration_plan', 'storyboard_assembly'],
      capabilityVersion: CAPABILITY_VERSION,
      metadata: { strictUnsupported: true }
    }
  },
  storyboard_exporter: {
    default: {
      providerType: 'storyboard_exporter',
      providerProfileId: 'default',
      supportedInputArtifacts: ['shot_list', 'reviewed_script', 'unified_verifier_package'],
      supportedOutputTargets: ['storyboard_json'],
      supportedStageTypes: ['storyboard_assembly'],
      supportedJobTypes: ['storyboard_assembly'],
      requiredFields: ['outputTargetMap', 'executionStages', 'executionJobs'],
      optionalFields: ['metadata'],
      unsupportedFeatures: ['subtitle_generation', 'narration_plan', 'composite_manifest', 'visual_assembly'],
      capabilityVersion: CAPABILITY_VERSION,
      metadata: { strictUnsupported: true, requiredOutputTypes: ['storyboard_json'] }
    }
  }
};

export function listProviderProfiles() {
  const rows = [];
  for (const providerType of Object.keys(PROFILES)) {
    for (const providerProfileId of Object.keys(PROFILES[providerType])) {
      rows.push(PROFILES[providerType][providerProfileId]);
    }
  }
  return { providerProfiles: rows };
}

export function getProviderProfile(providerType, providerProfileId = 'default') {
  const profile = PROFILES[providerType]?.[providerProfileId] || null;
  if (!profile) return { error: 'unsupported_provider_profile' };
  return { providerProfile: profile };
}
