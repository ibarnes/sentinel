import { normalizeFrameChain, accumulateFrameOffsets } from './frameAncestryService.js';

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function normalizeElementBox({ elementBox, screenshotMeta = {}, eventMeta = {} } = {}) {
  if (!elementBox || typeof elementBox !== 'object') {
    return { ok: false, reason: 'missing_element_box' };
  }

  const x = num(elementBox.x, NaN);
  const y = num(elementBox.y, NaN);
  const width = num(elementBox.width, NaN);
  const height = num(elementBox.height, NaN);
  if (![x, y, width, height].every(Number.isFinite)) {
    return { ok: false, reason: 'invalid_element_box_values' };
  }

  const dpr = Math.max(0.1, num(eventMeta.devicePixelRatio ?? screenshotMeta.devicePixelRatio, 1));
  const zoom = Math.max(0.1, num(eventMeta.zoom, 1));
  const cssScale = Math.max(0.1, num(eventMeta.cssTransformScale, 1));

  const viewportWidth = Math.max(1, num(eventMeta.viewportWidth ?? screenshotMeta.viewportWidth, 1));
  const viewportHeight = Math.max(1, num(eventMeta.viewportHeight ?? screenshotMeta.viewportHeight, 1));

  const scrollX = num(eventMeta.scrollX, 0);
  const scrollY = num(eventMeta.scrollY, 0);

  const chain = normalizeFrameChain(eventMeta.frameChain, {
    framePath: eventMeta.framePath,
    frameOrigin: eventMeta.frameOrigin,
    frameOffsetX: eventMeta.frameOffsetX,
    frameOffsetY: eventMeta.frameOffsetY,
    viewportWidth,
    viewportHeight
  });
  const chainOffset = accumulateFrameOffsets(chain);
  const frameOffsetX = num(chainOffset.x, 0);
  const frameOffsetY = num(chainOffset.y, 0);

  // canonical screenshot pixel-space coordinates
  const scale = dpr * zoom * cssScale;
  const nx = (x + frameOffsetX) * scale;
  const ny = (y + frameOffsetY) * scale;
  const nw = width * scale;
  const nh = height * scale;

  const screenshotWidth = Math.max(1, num(screenshotMeta.width, viewportWidth * dpr));
  const screenshotHeight = Math.max(1, num(screenshotMeta.height, viewportHeight * dpr));

  const out = {
    x: clamp(Math.round(nx), 0, screenshotWidth - 1),
    y: clamp(Math.round(ny), 0, screenshotHeight - 1),
    width: Math.max(1, Math.round(nw)),
    height: Math.max(1, Math.round(nh)),
    sourceViewport: { width: viewportWidth, height: viewportHeight },
    normalizedViewport: { width: screenshotWidth, height: screenshotHeight },
    devicePixelRatio: dpr,
    zoom,
    cssTransformScale: cssScale,
    scrollOffset: { x: scrollX, y: scrollY },
    frameOffset: { x: frameOffsetX, y: frameOffsetY },
    frameChain: chain,
    frameChainComplete: chainOffset.complete,
    frameChainUnresolvedSegments: chainOffset.unresolvedSegments,
    frameChainImpossible: chainOffset.impossible
  };

  const projected = {
    x: Math.round(x * dpr),
    y: Math.round(y * dpr),
    width: Math.max(1, Math.round(width * dpr)),
    height: Math.max(1, Math.round(height * dpr))
  };

  const driftRatio = Math.max(
    Math.abs(out.x - projected.x) / Math.max(1, projected.width),
    Math.abs(out.y - projected.y) / Math.max(1, projected.height),
    Math.abs(out.width - projected.width) / Math.max(1, projected.width),
    Math.abs(out.height - projected.height) / Math.max(1, projected.height)
  );

  return {
    ok: true,
    box: out,
    driftRatio,
    driftWarning: driftRatio > 0.2
  };
}

export function validateNormalizedBox(box, viewport, minSize = 4) {
  if (!box || !viewport) return { ok: false, reason: 'missing_box_or_viewport' };
  const maxW = num(viewport.width, 0);
  const maxH = num(viewport.height, 0);
  if (box.x < 0 || box.y < 0) return { ok: false, reason: 'negative_coordinates' };
  if (box.width < minSize || box.height < minSize) return { ok: false, reason: 'below_min_threshold' };
  if (box.x >= maxW || box.y >= maxH) return { ok: false, reason: 'origin_out_of_bounds' };
  if ((box.x + box.width) > maxW + 2 || (box.y + box.height) > maxH + 2) return { ok: false, reason: 'box_out_of_bounds' };
  return { ok: true };
}
