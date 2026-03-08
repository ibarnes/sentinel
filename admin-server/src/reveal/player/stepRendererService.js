import { deriveHotspots, deriveOverlay, progressionStateForStep } from './interactionDerivationService.js';

export function toPlaybackStep(step, idx, assetResolver, stepCount = 0) {
  const assets = assetResolver(step);
  const hotspots = deriveHotspots(step, idx, stepCount || 0);
  const overlay = deriveOverlay(step, hotspots, idx);
  const progression = progressionStateForStep({ ...step, overlay });

  return {
    index: idx,
    title: step.title || `Step ${idx + 1}`,
    action: step.action || 'action',
    intent: step.intent || null,
    screenshotBefore: assets.before,
    screenshotAfter: assets.after,
    highlight: assets.highlight,
    annotations: step.annotations || [],
    confidence: step.confidence ?? null,
    stepDurationMs: Number(step.stepDurationMs || 3000),
    hotspots,
    overlay,
    progression
  };
}
