import { getProviderProfile } from './providerCapabilityService.js';

export function validateProviderExecutionPayload(payload) {
  if (!payload || typeof payload !== 'object') return { status: 'malformed_provider_execution_payload', reasonCodes: ['missing_payload'] };

  const required = ['payloadType','payloadVersion','providerType','providerProfileId','executionRef','executionStages','executionJobs','inputArtifactMap','outputTargetMap','timingPlan','trustRefs','admissionRefs','schedulerRefs','executionHints'];
  const missing = required.filter((k) => payload[k] === undefined);
  if (missing.length) return { status: 'malformed_provider_execution_payload', reasonCodes: ['missing_required_fields'], missingFields: missing };

  const prof = getProviderProfile(payload.providerType, payload.providerProfileId);
  if (prof.error) return { status: 'capability_mismatch', reasonCodes: ['unsupported_provider_profile'] };
  const p = prof.providerProfile;

  const blocks = [];
  const warnings = [];
  if (!Array.isArray(payload.executionStages) || !Array.isArray(payload.executionJobs)) blocks.push('malformed_provider_execution_payload');

  const sst = new Set(p.supportedStageTypes || []);
  const sjt = new Set(p.supportedJobTypes || []);
  const sot = new Set(p.supportedOutputTargets || []);
  const sit = new Set(p.supportedInputArtifacts || []);

  if ((payload.executionStages || []).some((s) => !sst.has(s.stageType))) blocks.push('unsupported_stage_type');
  if ((payload.executionJobs || []).some((j) => !sjt.has(j.jobType))) blocks.push('capability_mismatch');
  if ((payload.outputTargetMap || []).some((o) => !sot.has(o.outputType))) blocks.push('unsupported_output_target');
  if ((payload.inputArtifactMap || []).some((a) => !sit.has(a.artifactType))) warnings.push('unsupported_input_artifact_pruned');

  for (const req of (p.requiredInputArtifacts || [])) {
    if (!(payload.inputArtifactMap || []).some((a) => a.artifactType === req)) blocks.push('missing_required_input');
  }

  if (!payload.trustRefs) warnings.push('trust_mismatch');

  if (blocks.length) {
    const status = blocks.includes('missing_required_input') ? 'missing_required_input' : blocks.includes('unsupported_output_target') ? 'unsupported_output_target' : blocks.includes('unsupported_stage_type') ? 'unsupported_stage_type' : 'blocked';
    return { status, reasonCodes: [...new Set(blocks)] };
  }
  if (warnings.length) return { status: 'valid_with_warnings', reasonCodes: [...new Set(warnings)] };
  return { status: 'valid', reasonCodes: ['provider_execution_payload_valid'] };
}
