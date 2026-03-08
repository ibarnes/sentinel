import { getProviderProfile } from './providerCapabilityService.js';

function intersectBy(items, allowedSet, key) {
  return (items || []).filter((item) => allowedSet.has(item[key]));
}

export function mapRenderAdapterToProvider({ renderAdapterContract, providerType, providerProfileId = 'default' }) {
  const p = getProviderProfile(providerType, providerProfileId);
  if (p.error) return p;
  const profile = p.providerProfile;

  const blocks = [];
  const warnings = [];

  const supportedStageTypes = new Set(profile.supportedStageTypes || []);
  const supportedJobTypes = new Set(profile.supportedJobTypes || []);
  const supportedInputArtifacts = new Set(profile.supportedInputArtifacts || []);
  const supportedOutputTargets = new Set(profile.supportedOutputTargets || []);

  const rawStages = renderAdapterContract?.executionPlan?.stages || [];
  const rawJobs = renderAdapterContract?.executionPlan?.jobs || [];
  const rawInputs = renderAdapterContract?.inputArtifacts || [];
  const rawOutputs = renderAdapterContract?.outputTargets || [];

  const unsupportedStages = rawStages.filter((s) => !supportedStageTypes.has(s.stageType));
  const unsupportedJobs = rawJobs.filter((j) => !supportedJobTypes.has(j.jobType));
  const unsupportedInputs = rawInputs.filter((a) => !supportedInputArtifacts.has(a.artifactType));
  const unsupportedOutputs = rawOutputs.filter((o) => !supportedOutputTargets.has(o.outputType));

  if (profile.metadata?.strictUnsupported) {
    if (unsupportedStages.length) blocks.push('unsupported_stage_type');
    if (unsupportedJobs.length) blocks.push('unsupported_job_type');
    if (unsupportedOutputs.length) blocks.push('unsupported_output_target');
  } else {
    if (unsupportedStages.length) warnings.push('unsupported_stage_type_pruned');
    if (unsupportedJobs.length) warnings.push('unsupported_job_type_pruned');
    if (unsupportedOutputs.length) warnings.push('unsupported_output_target_pruned');
  }

  if (unsupportedInputs.length) warnings.push('unsupported_input_artifact_pruned');

  const executionStages = intersectBy(rawStages, supportedStageTypes, 'stageType');
  const allowedStageIds = new Set(executionStages.map((s) => s.stageId));
  for (const stage of executionStages) {
    stage.dependencyStageIds = (stage.dependencyStageIds || []).filter((id) => allowedStageIds.has(id));
  }

  const executionJobs = intersectBy(rawJobs, supportedJobTypes, 'jobType').filter((j) => allowedStageIds.has(j.stageId));
  const inputArtifactMap = rawInputs.filter((a) => supportedInputArtifacts.has(a.artifactType));
  const outputTargetMap = rawOutputs.filter((o) => supportedOutputTargets.has(o.outputType));

  const requiredOutputs = profile.metadata?.requiredOutputTypes || [];
  for (const t of requiredOutputs) {
    if (!outputTargetMap.some((o) => o.outputType === t)) blocks.push('missing_required_output_target');
  }

  if (!(renderAdapterContract?.renderAdapterContractId)) blocks.push('missing_render_adapter_contract_id');

  const capabilityMappingSummary = {
    supportedStageCount: executionStages.length,
    skippedStageCount: unsupportedStages.length,
    supportedJobCount: executionJobs.length,
    skippedJobCount: unsupportedJobs.length,
    supportedInputCount: inputArtifactMap.length,
    skippedInputCount: unsupportedInputs.length,
    supportedOutputCount: outputTargetMap.length,
    skippedOutputCount: unsupportedOutputs.length
  };

  return {
    providerProfile: profile,
    mapped: {
      executionStages,
      executionJobs,
      inputArtifactMap,
      outputTargetMap,
      timingHints: renderAdapterContract?.executionPlan?.timingPlan || { expectedDurationMs: 0, deterministic: true },
      capabilityMappingSummary
    },
    blockingReasons: [...new Set(blocks)],
    warnings: [...new Set(warnings)]
  };
}
