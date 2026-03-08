export function deriveOutputTargets({ adapterType = 'storyboard_export' } = {}) {
  const base = [];
  const push = (outputType, format, stage) => base.push({
    outputTargetId: `ot_${base.length + 1}`,
    outputType,
    format,
    pathHint: `/outputs/${outputType}.${format === 'json' ? 'json' : format}`,
    requiredProducerStageId: stage,
    readinessRequirements: [],
    metadata: {}
  });

  if (adapterType === 'storyboard_export') {
    push('storyboard_json', 'json', 'stage_storyboard');
    push('edit_decision_list', 'json', 'stage_storyboard');
  } else if (adapterType === 'subtitle_only') {
    push('subtitle_track', 'srt', 'stage_subtitle');
    push('subtitle_track', 'vtt', 'stage_subtitle');
  } else if (adapterType === 'visual_only') {
    push('assembly_bundle', 'json', 'stage_visual');
    push('composite_job_manifest', 'json', 'stage_visual');
  } else if (adapterType === 'narrated_walkthrough') {
    push('narration_plan', 'json', 'stage_narration');
    push('subtitle_track', 'vtt', 'stage_subtitle');
    push('composite_job_manifest', 'json', 'stage_compose');
  } else {
    push('composite_job_manifest', 'json', 'stage_compose');
    push('assembly_bundle', 'json', 'stage_compose');
  }

  return base;
}
