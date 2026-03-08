function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function pctBoxFromPixel(box, viewport) {
  if (!box || !viewport?.width || !viewport?.height) return null;
  const x = clamp((box.x / viewport.width) * 100, 0, 100);
  const y = clamp((box.y / viewport.height) * 100, 0, 100);
  const w = clamp((box.width / viewport.width) * 100, 1, 100);
  const h = clamp((box.height / viewport.height) * 100, 1, 100);
  return { x, y, width: w, height: h };
}

function validHotspot(h, stepCount) {
  if (!h) return false;
  const nums = [h.x, h.y, h.width, h.height].every((v) => Number.isFinite(Number(v)));
  if (!nums) return false;
  if (h.width <= 0 || h.height <= 0) return false;
  if (h.targetStepIndex != null && (h.targetStepIndex < 0 || h.targetStepIndex >= stepCount)) return false;
  return true;
}

export function deriveHotspots(step, stepIndex, stepCount) {
  const out = [];
  const idBase = `hs_${stepIndex}`;

  const nh = step.metadata?.normalizedHighlightBox;
  const pv = nh?.normalizedViewport;
  const boxPct = nh ? pctBoxFromPixel(nh, pv) : (step.target?.elementBox ? pctBoxFromPixel(step.target.elementBox, { width: 1280, height: 720 }) : null);

  if (boxPct) {
    out.push({
      hotspotId: `${idBase}_primary`,
      stepIndex,
      type: 'primary_target',
      label: step.target?.text || step.title || 'Primary target',
      description: step.intent || null,
      ...boxPct,
      targetAction: 'confirm_target',
      targetStepIndex: null,
      interactionMode: 'click',
      priority: 1,
      visible: true,
      metadata: {}
    });
  }

  if ((step.annotations || []).length) {
    out.push({
      hotspotId: `${idBase}_info_1`,
      stepIndex,
      type: 'info',
      label: 'Note',
      description: step.annotations[0]?.text || null,
      x: 4,
      y: 4,
      width: 30,
      height: 12,
      targetAction: 'show_info',
      targetStepIndex: null,
      interactionMode: 'click',
      priority: 2,
      visible: true,
      metadata: { from: 'annotation' }
    });
  }

  return out.filter((h) => validHotspot(h, stepCount));
}

export function deriveOverlay(step, hotspots, stepIndex) {
  const primary = hotspots.find((h) => h.type === 'primary_target') || null;
  const progressionMode = primary ? 'hotspot_click' : 'manual';
  return {
    title: step.title || `Step ${stepIndex + 1}`,
    body: step.intent || (step.annotations || []).map((a) => a.text).slice(0, 1).join(' ') || 'Follow this step.',
    position: 'right',
    anchorHotspotId: primary?.hotspotId || null,
    dismissible: true,
    showStepCounter: true,
    emphasisMode: primary ? 'dim_background' : 'none',
    progressionMode,
    stepDurationMs: Number(step.stepDurationMs || 3000)
  };
}

export function progressionStateForStep(step) {
  const mode = step.overlay?.progressionMode || 'manual';
  return {
    progressionMode: mode,
    requiresHotspotConfirmation: mode === 'hotspot_click',
    canAutoAdvance: mode === 'auto',
    stepDurationMs: Number(step.overlay?.stepDurationMs || step.stepDurationMs || 3000)
  };
}
