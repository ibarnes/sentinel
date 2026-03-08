export function toPlaybackStep(step, idx, assetResolver) {
  const assets = assetResolver(step);
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
    stepDurationMs: Number(step.stepDurationMs || 3000)
  };
}
