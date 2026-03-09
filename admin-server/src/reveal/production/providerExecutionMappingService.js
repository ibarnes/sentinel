import { getProviderProfile } from './providerCapabilityService.js';

export function mapSubmissionToProviderExecution({ submission, providerType, providerProfileId = 'default', receipt = null, schedulerBoard = null }) {
  const prof = getProviderProfile(providerType, providerProfileId);
  if (prof.error) return prof;
  const profile = prof.providerProfile;

  const blocks = [];
  const warnings = [];

  const supportedStages = new Set(profile.supportedStageTypes || []);
  const supportedJobs = new Set(profile.supportedJobTypes || []);
  const supportedOutputs = new Set(profile.supportedOutputTargets || []);
  const supportedInputs = new Set(profile.supportedInputArtifacts || []);

  const executionStages = (submission.executionStages || []).filter((s) => supportedStages.has(s.stageType));
  const allowedStageIds = new Set(executionStages.map((s) => s.stageId));
  const executionJobs = (submission.executionJobs || []).filter((j) => supportedJobs.has(j.jobType) && allowedStageIds.has(j.stageId));
  const inputArtifactMap = (submission.inputArtifactRefs || []).filter((a) => supportedInputs.has(a.artifactType));
  const outputTargetMap = (submission.outputTargetRefs || []).filter((o) => supportedOutputs.has(o.outputType));

  const unsupportedStageCount = (submission.executionStages || []).length - executionStages.length;
  const unsupportedJobCount = (submission.executionJobs || []).length - executionJobs.length;
  const unsupportedOutputCount = (submission.outputTargetRefs || []).length - outputTargetMap.length;

  if (unsupportedStageCount) (profile.metadata?.strictUnsupported ? blocks : warnings).push('unsupported_stage_type');
  if (unsupportedJobCount) (profile.metadata?.strictUnsupported ? blocks : warnings).push('unsupported_job_type');
  if (unsupportedOutputCount) (profile.metadata?.strictUnsupported ? blocks : warnings).push('unsupported_output_target');

  for (const req of (profile.requiredInputArtifacts || [])) {
    if (!inputArtifactMap.some((a) => a.artifactType === req)) blocks.push('missing_required_input');
  }
  for (const reqOut of (profile.metadata?.requiredOutputTypes || [])) {
    if (!outputTargetMap.some((o) => o.outputType === reqOut)) blocks.push('unsupported_output_target');
  }

  if (providerType === 'subtitle_compositor' && !outputTargetMap.some((o) => o.outputType === 'subtitle_track')) blocks.push('missing_required_input');
  if (providerType === 'narration_pipeline' && !outputTargetMap.some((o) => o.outputType === 'narration_plan')) blocks.push('missing_required_input');

  const capabilityMappingSummary = {
    providerType,
    providerProfileId,
    supportedStageCount: executionStages.length,
    supportedJobCount: executionJobs.length,
    supportedInputCount: inputArtifactMap.length,
    supportedOutputCount: outputTargetMap.length,
    unsupportedStageCount,
    unsupportedJobCount,
    unsupportedOutputCount
  };

  const providerExecutionPayload = {
    payloadType: 'provider_execution_payload',
    payloadVersion: profile.payloadVersion || 'v1',
    providerType,
    providerProfileId,
    executionRef: {
      providerSubmissionContractId: submission.providerSubmissionContractId,
      providerAdapterId: submission.providerAdapterId,
      sourceRenderAdapterContractId: submission.submissionPayload?.manifestRef?.sourceRenderAdapterContractId || null
    },
    executionStages,
    executionJobs,
    inputArtifactMap,
    outputTargetMap,
    timingPlan: submission.submissionPayload?.timingPlan || { expectedDurationMs: 0, deterministic: true },
    trustRefs: submission.trustRefs || submission.submissionPayload?.trustRefs || {},
    admissionRefs: submission.submissionPayload?.admissionRefs || {},
    schedulerRefs: {
      schedulerBoardId: schedulerBoard?.schedulerBoardId || null,
      schedulerBoardDigest: schedulerBoard?.boardDigest || null,
      executionReceiptId: receipt?.executionReceiptId || null,
      submissionDigest: submission.payloadDigest
    },
    executionHints: {
      submissionMode: submission.submissionMode,
      targetEndpointProfile: submission.targetEndpointProfile,
      deterministic: true
    },
    metadata: { deterministic: true }
  };

  return { providerProfile: profile, providerExecutionPayload, capabilityMappingSummary, blockingReasons: [...new Set(blocks)], warnings: [...new Set(warnings)] };
}
