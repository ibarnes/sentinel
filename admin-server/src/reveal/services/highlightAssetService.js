import fs from 'fs/promises';
import { assetPath, writeDataUrlAsset } from '../storage/revealStorage.js';
import { normalizeElementBox, validateNormalizedBox } from './coordinateNormalizationService.js';
import { scoreCoordinateConfidence, buildViewportDiagnostics } from './coordinateDiagnosticsService.js';
import { normalizeFrameChain, accumulateFrameOffsets, frameChainSummary } from './frameAncestryService.js';

export async function persistStepScreenshotSet({ sessionId, stepId, firstRaw, lastRaw, targetBox, eventMeta = {} }) {
  const beforeFile = assetPath(sessionId, stepId, 'before');
  const afterFile = assetPath(sessionId, stepId, 'after');
  const highlightFile = assetPath(sessionId, stepId, 'highlight');

  const beforeData = firstRaw?.screenshot?.dataUrl || null;
  const afterData = lastRaw?.screenshot?.dataUrl || null;
  const highlightData = lastRaw?.highlight?.dataUrl || null;

  const beforeOk = await writeDataUrlAsset(beforeFile, beforeData);
  const afterOk = await writeDataUrlAsset(afterFile, afterData);

  const frameChain = normalizeFrameChain(lastRaw?.frameChain || eventMeta.frameChain, {
    framePath: lastRaw?.framePath || eventMeta.framePath,
    frameOrigin: lastRaw?.frameOrigin || eventMeta.frameOrigin,
    frameOffsetX: lastRaw?.frameOffsetX || eventMeta.frameOffsetX,
    frameOffsetY: lastRaw?.frameOffsetY || eventMeta.frameOffsetY,
    viewportWidth: lastRaw?.viewport?.width || eventMeta.viewportWidth,
    viewportHeight: lastRaw?.viewport?.height || eventMeta.viewportHeight
  });
  const frameOffsetAgg = accumulateFrameOffsets(frameChain);

  const screenshotMeta = {
    width: Number(lastRaw?.highlight?.metadata?.width || 0),
    height: Number(lastRaw?.highlight?.metadata?.height || 0),
    viewportWidth: Number(lastRaw?.viewport?.width || eventMeta.viewportWidth || 0),
    viewportHeight: Number(lastRaw?.viewport?.height || eventMeta.viewportHeight || 0),
    devicePixelRatio: Number(lastRaw?.devicePixelRatio || eventMeta.devicePixelRatio || 1)
  };

  const normalized = normalizeElementBox({
    elementBox: targetBox,
    screenshotMeta,
    eventMeta: {
      devicePixelRatio: lastRaw?.devicePixelRatio ?? eventMeta.devicePixelRatio,
      viewportWidth: lastRaw?.viewport?.width ?? eventMeta.viewportWidth,
      viewportHeight: lastRaw?.viewport?.height ?? eventMeta.viewportHeight,
      scrollX: lastRaw?.scrollX ?? eventMeta.scrollX,
      scrollY: lastRaw?.scrollY ?? eventMeta.scrollY,
      framePath: lastRaw?.framePath ?? eventMeta.framePath,
      frameOrigin: lastRaw?.frameOrigin ?? eventMeta.frameOrigin,
      frameOffsetX: frameOffsetAgg.x,
      frameOffsetY: frameOffsetAgg.y,
      frameChain,
      zoom: lastRaw?.zoom ?? eventMeta.zoom,
      cssTransformScale: lastRaw?.cssTransformScale ?? eventMeta.cssTransformScale
    }
  });

  const validation = normalized.ok ? validateNormalizedBox(normalized.box, normalized.box.normalizedViewport) : { ok: false, reason: normalized.reason };

  let highlightOk = false;
  let highlightMode = 'fallback';
  let highlightReason = 'missing_highlight_payload';

  if (!normalized.ok) {
    highlightReason = normalized.reason;
  } else if (normalized.box.frameChainImpossible) {
    highlightReason = 'impossible_cumulative_offsets';
  } else if (Number(screenshotMeta.viewportWidth) <= 0 || Number(screenshotMeta.viewportHeight) <= 0) {
    highlightReason = 'invalid_viewport_metadata';
  } else if (!validation.ok) {
    highlightReason = validation.reason;
  } else if (!highlightData) {
    highlightReason = 'missing_highlight_payload';
  } else {
    highlightOk = await writeDataUrlAsset(highlightFile, highlightData);
    highlightMode = highlightOk ? 'rendered' : 'fallback';
    highlightReason = highlightOk ? null : 'highlight_write_failed';
  }

  const rel = (ok, kind) => (ok ? `/reveal/storage/assets/${sessionId}/${stepId}/${kind}.jpg` : null);

  const sourceValidation = {
    beforeSourceMissing: !beforeData,
    afterSourceMissing: !afterData
  };

  if (beforeOk) await fs.access(beforeFile).catch(() => { sourceValidation.beforeSourceMissing = true; });
  if (afterOk) await fs.access(afterFile).catch(() => { sourceValidation.afterSourceMissing = true; });

  const provenance = {
    captureSource: 'extension_background',
    timestamp: lastRaw?.timestamp || new Date().toISOString(),
    devicePixelRatio: Number(lastRaw?.devicePixelRatio || eventMeta.devicePixelRatio || 1),
    zoom: Number(lastRaw?.zoom || eventMeta.zoom || 1),
    cssTransformScale: Number(lastRaw?.cssTransformScale || eventMeta.cssTransformScale || 1),
    viewportWidth: Number(lastRaw?.viewport?.width || eventMeta.viewportWidth || 0),
    viewportHeight: Number(lastRaw?.viewport?.height || eventMeta.viewportHeight || 0),
    scrollX: Number(lastRaw?.scrollX || eventMeta.scrollX || 0),
    scrollY: Number(lastRaw?.scrollY || eventMeta.scrollY || 0),
    frameContext: {
      framePath: lastRaw?.framePath || eventMeta.framePath || 'top',
      frameOrigin: lastRaw?.frameOrigin || eventMeta.frameOrigin || null,
      frameOffsetX: Number(frameOffsetAgg.x || 0),
      frameOffsetY: Number(frameOffsetAgg.y || 0),
      frameChain,
      frameChainSummary: frameChainSummary(frameChain),
      frameChainComplete: frameOffsetAgg.complete,
      frameChainUnresolvedSegments: frameOffsetAgg.unresolvedSegments,
      frameChainImpossible: frameOffsetAgg.impossible
    },
    highlightNormalizationApplied: Boolean(normalized.ok),
    highlightFallbackReason: highlightReason || null
  };

  const diagnostics = buildViewportDiagnostics({
    normalized,
    validation,
    screenshotMeta,
    projectedBox: normalized.ok ? normalized.box : null
  });

  const confidence = scoreCoordinateConfidence({
    normalized,
    validation,
    provenance,
    highlightMode,
    driftWarning: Boolean(normalized.ok && normalized.driftWarning)
  });

  return {
    screenshots: {
      beforeUrl: rel(beforeOk, 'before'),
      afterUrl: rel(afterOk, 'after'),
      highlightedUrl: rel(highlightOk, 'highlight')
    },
    highlight: {
      mode: highlightMode,
      reason: highlightReason,
      normalizedBox: normalized.ok ? normalized.box : null,
      driftRatio: normalized.ok ? Number(normalized.driftRatio.toFixed(3)) : null,
      driftWarning: Boolean(normalized.ok && normalized.driftWarning)
    },
    sourceValidation,
    provenance,
    diagnostics,
    confidence
  };
}
