import { getFlowCompare } from './compareService.js';
import { normalizeElementBox, validateNormalizedBox } from './coordinateNormalizationService.js';

function ensureTraceArray(trace, traceName) {
  if (!Array.isArray(trace)) return [{ stage: 'trace_error', input: null, output: null, op: `invalid_${traceName}` }];
  return trace.map((t) => ({
    stage: t?.stage || 'unknown_stage',
    input: t?.input ?? null,
    output: t?.output ?? null,
    op: t?.op || 'unknown_op',
    warning: Boolean(t?.warning)
  }));
}

export async function buildStepCoordinateReplay(flowId, stepId) {
  const compare = await getFlowCompare(flowId);
  if (compare.error) return { error: 'flow_not_found', reasons: [compare.error] };

  const reviewed = compare.reviewed || compare.baseline;
  const reviewedStep = (reviewed.steps || []).find((s) => s.id === stepId);
  if (!reviewedStep) return { error: 'step_not_found', reasons: ['missing_step_in_reviewed_or_baseline'] };

  const baseStep = (compare.baseline.steps || []).find((s) => s.id === stepId) || null;
  const mergedFrom = reviewedStep.metadata?.mergedFrom;

  let replaySource = 'reviewed_with_baseline_link';
  let sourceStep = baseStep || reviewedStep;
  const warnings = [];

  if (!baseStep && Array.isArray(mergedFrom) && mergedFrom.length) {
    const candidate = (compare.baseline.steps || []).find((s) => s.id === mergedFrom[0]);
    if (candidate) {
      sourceStep = candidate;
      replaySource = 'reviewed_merged_baseline_first_source';
      warnings.push('merged_step_replay_uses_first_baseline_source');
    } else {
      replaySource = 'reviewed_without_baseline_lineage';
      warnings.push('no_baseline_lineage_for_reviewed_step');
    }
  }

  const sourceBox = sourceStep?.target?.elementBox || null;
  const provenance = sourceStep?.screenshots?.provenance || {};
  const diagnostics = sourceStep?.screenshots?.diagnostics || {};
  const renderedImage = diagnostics.renderedImageDimensions || sourceStep?.metadata?.normalizedHighlightBox?.normalizedViewport || null;
  if (renderedImage && (!Number.isFinite(Number(renderedImage.width)) || !Number.isFinite(Number(renderedImage.height)) || Number(renderedImage.width) <= 0 || Number(renderedImage.height) <= 0)) {
    warnings.push('incompatible_render_dimensions');
  }

  const normalized = normalizeElementBox({
    elementBox: sourceBox,
    screenshotMeta: {
      width: renderedImage?.width || 0,
      height: renderedImage?.height || 0,
      viewportWidth: provenance.viewportWidth || 0,
      viewportHeight: provenance.viewportHeight || 0,
      devicePixelRatio: provenance.devicePixelRatio || 1
    },
    eventMeta: {
      devicePixelRatio: provenance.devicePixelRatio || 1,
      zoom: provenance.zoom || 1,
      cssTransformScale: provenance.cssTransformScale || 1,
      viewportWidth: provenance.viewportWidth || 0,
      viewportHeight: provenance.viewportHeight || 0,
      scrollX: provenance.scrollX || 0,
      scrollY: provenance.scrollY || 0,
      frameChain: provenance.frameContext?.frameChain || null,
      framePath: provenance.frameContext?.framePath || 'top',
      frameOrigin: provenance.frameContext?.frameOrigin || null,
      frameOffsetX: provenance.frameContext?.frameOffsetX || 0,
      frameOffsetY: provenance.frameContext?.frameOffsetY || 0
    }
  });

  const validation = normalized.ok
    ? validateNormalizedBox(normalized.box, normalized.box.normalizedViewport)
    : { ok: false, reason: normalized.reason, trace: [] };

  if (!normalized.ok) warnings.push(`normalization_failed:${normalized.reason}`);
  if (!validation.ok) warnings.push(`validation_failed:${validation.reason}`);
  if (!sourceBox) warnings.push('missing_source_box');

  return {
    stepId,
    replaySource,
    sourceBox,
    sourceViewport: {
      width: provenance.viewportWidth || 0,
      height: provenance.viewportHeight || 0,
      scrollX: provenance.scrollX || 0,
      scrollY: provenance.scrollY || 0
    },
    sourceScales: {
      devicePixelRatio: provenance.devicePixelRatio || 1,
      zoom: provenance.zoom || 1,
      cssTransformScale: provenance.cssTransformScale || 1
    },
    frameTrace: provenance.frameContext || {},
    normalizationTrace: ensureTraceArray(normalized.trace || [], 'normalization_trace'),
    validationTrace: ensureTraceArray(validation.trace || [], 'validation_trace'),
    finalBoxes: {
      normalizedBox: normalized.ok ? normalized.box : null,
      renderedBox: sourceStep?.metadata?.normalizedHighlightBox || null,
      projectedBox: normalized.projectedBox || null
    },
    finalHighlight: {
      mode: sourceStep?.metadata?.highlightMode || 'fallback',
      fallbackReason: sourceStep?.metadata?.highlightFallbackReason || null,
      driftRatio: sourceStep?.metadata?.highlightDriftRatio ?? null,
      driftWarning: Boolean(sourceStep?.metadata?.highlightDriftWarning)
    },
    warnings,
    coordinateConfidence: sourceStep?.coordinateConfidence ?? 0,
    coordinateConfidenceReasonCodes: sourceStep?.coordinateConfidenceReasonCodes || []
  };
}
