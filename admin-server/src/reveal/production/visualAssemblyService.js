export function visualRefsForStep(step = {}) {
  return {
    screenshotBefore: step.screenshotBefore || null,
    screenshotAfter: step.screenshotAfter || null,
    highlight: step.highlight || null,
    hotspots: (step.hotspots || []).map((h) => h.hotspotId),
    overlay: step.overlay || null
  };
}

export function hasMajorTransition(prev = null, next = null) {
  if (!prev || !next) return false;
  const p = prev.metadata?.pageUrl || prev.page?.url || '';
  const n = next.metadata?.pageUrl || next.page?.url || '';
  return Boolean(p && n && p !== n);
}
