export function buildExecutionPlan({ adapterType = 'storyboard_export', inputArtifacts = [], outputTargets = [] } = {}) {
  const stages = [];
  const jobs = [];
  const dependencies = [];

  const addStage = (stageId, stageType, orderIndex, requiredInputs = [], producedOutputs = [], dep = []) => {
    stages.push({
      stageId,
      stageType,
      orderIndex,
      requiredInputs,
      producedOutputs,
      dependencyStageIds: dep,
      executionHints: {},
      statusRequirements: ['ready'],
      metadata: {}
    });
  };

  if (adapterType === 'subtitle_only') {
    addStage('stage_subtitle', 'subtitle_generation', 0, inputArtifacts.map((a) => a.artifactId), outputTargets.map((o) => o.outputTargetId));
  } else if (adapterType === 'storyboard_export') {
    addStage('stage_storyboard', 'storyboard_assembly', 0, inputArtifacts.map((a) => a.artifactId), outputTargets.map((o) => o.outputTargetId));
  } else if (adapterType === 'visual_only') {
    addStage('stage_visual', 'visual_assembly', 0, inputArtifacts.map((a) => a.artifactId), outputTargets.map((o) => o.outputTargetId));
  } else if (adapterType === 'narrated_walkthrough') {
    addStage('stage_narration', 'narration_plan', 0, inputArtifacts.map((a) => a.artifactId), outputTargets.filter((o) => o.outputType === 'narration_plan').map((o) => o.outputTargetId));
    addStage('stage_subtitle', 'subtitle_generation', 1, inputArtifacts.map((a) => a.artifactId), outputTargets.filter((o) => o.outputType === 'subtitle_track').map((o) => o.outputTargetId), ['stage_narration']);
    addStage('stage_compose', 'composite_manifest', 2, inputArtifacts.map((a) => a.artifactId), outputTargets.filter((o) => o.outputType === 'composite_job_manifest').map((o) => o.outputTargetId), ['stage_subtitle']);
    dependencies.push({ from: 'stage_narration', to: 'stage_subtitle' }, { from: 'stage_subtitle', to: 'stage_compose' });
  } else {
    addStage('stage_compose', 'composite_manifest', 0, inputArtifacts.map((a) => a.artifactId), outputTargets.map((o) => o.outputTargetId));
  }

  stages.forEach((s) => {
    jobs.push({
      jobId: `job_${s.orderIndex + 1}`,
      jobType: s.stageType,
      stageId: s.stageId,
      orderIndex: s.orderIndex,
      inputRefs: s.requiredInputs,
      outputRefs: s.producedOutputs,
      executionHints: { deterministic: true },
      fallbackPolicy: 'fail_fast',
      metadata: {}
    });
  });

  return {
    stages,
    jobs,
    dependencies,
    timingPlan: { expectedDurationMs: 0, deterministic: true },
    assetMap: inputArtifacts.map((a) => ({ artifactId: a.artifactId, artifactRef: a.artifactRef })),
    outputPlan: outputTargets
  };
}
