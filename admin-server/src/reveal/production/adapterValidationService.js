const ADAPTER_TYPES = new Set(['storyboard_export','narrated_walkthrough','subtitle_only','visual_only','composite_render']);
const PROFILES = new Set(['dev','internal_verified','production_verified']);

export function validateAdapterContract(contract) {
  if (!contract || typeof contract !== 'object') return { status: 'malformed_contract', errors: ['missing_contract'] };
  const errors = [];
  const warnings = [];

  if (!contract.adapterType || !ADAPTER_TYPES.has(contract.adapterType)) errors.push('unsupported_adapter_type');
  if (!contract.orchestrationProfile || !PROFILES.has(contract.orchestrationProfile)) errors.push('unsupported_orchestration_profile');
  if (!Array.isArray(contract.inputArtifacts)) errors.push('input_artifacts_missing');
  if (!Array.isArray(contract.outputTargets)) errors.push('output_targets_missing');
  if (!contract.executionPlan || !Array.isArray(contract.executionPlan.stages) || !Array.isArray(contract.executionPlan.jobs)) errors.push('execution_plan_missing');

  const missingRequired = (contract.inputArtifacts || []).filter((a) => a.required && !a.available);
  if (missingRequired.length) errors.push('missing_required_artifact');

  if (contract.readinessState === 'blocked' && contract.orchestrationProfile === 'dev') warnings.push('dev_profile_blocked_contract');

  if (errors.length) {
    const status = errors.includes('missing_required_artifact') ? 'missing_required_artifact' : 'malformed_contract';
    return { status, errors, warnings };
  }

  if (contract.readinessState === 'blocked') return { status: 'blocked', errors: [], warnings: [...warnings, ...(contract.blockingReasons || [])] };
  if ((contract.warnings || []).length || warnings.length) return { status: 'valid_with_warnings', errors: [], warnings: [...warnings, ...(contract.warnings || [])] };
  return { status: 'valid', errors: [], warnings: [] };
}
