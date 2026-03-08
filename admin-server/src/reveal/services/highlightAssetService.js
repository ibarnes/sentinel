import fs from 'fs/promises';
import { assetPath, writeDataUrlAsset } from '../storage/revealStorage.js';
import { normalizeElementBox, validateNormalizedBox } from './coordinateNormalizationService.js';

export async function persistStepScreenshotSet({ sessionId, stepId, firstRaw, lastRaw, targetBox, eventMeta = {} }) {
  const beforeFile = assetPath(sessionId, stepId, 'before');
  const afterFile = assetPath(sessionId, stepId, 'after');
  const highlightFile = assetPath(sessionId, stepId, 'highlight');

  const beforeData = firstRaw?.screenshot?.dataUrl || null;
  const afterData = lastRaw?.screenshot?.dataUrl || null;
  const highlightData = lastRaw?.highlight?.dataUrl || null;

  const beforeOk = await writeDataUrlAsset(beforeFile, beforeData);
  const afterOk = await writeDataUrlAsset(afterFile, afterData);

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
      frameOffsetX: lastRaw?.frameOffsetX ?? eventMeta.frameOffsetX,
      frameOffsetY: lastRaw?.frameOffsetY ?? eventMeta.frameOffsetY,
      zoom: lastRaw?.zoom ?? eventMeta.zoom,
      cssTransformScale: lastRaw?.cssTransformScale ?? eventMeta.cssTransformScale
    }
  });

  let highlightOk = false;
  let highlightMode = 'fallback';
  let highlightReason = 'missing_highlight_payload';

  if (!normalized.ok) {
    highlightReason = normalized.reason;
  } else {
    const v = validateNormalizedBox(normalized.box, normalized.box.normalizedViewport);
    if (!v.ok) {
      highlightReason = v.reason;
    } else if (!highlightData) {
      highlightReason = 'missing_highlight_payload';
    } else {
      highlightOk = await writeDataUrlAsset(highlightFile, highlightData);
      highlightMode = highlightOk ? 'rendered' : 'fallback';
      highlightReason = highlightOk ? null : 'highlight_write_failed';
    }
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
    viewportWidth: Number(lastRaw?.viewport?.width || eventMeta.viewportWidth || 0),
    viewportHeight: Number(lastRaw?.viewport?.height || eventMeta.viewportHeight || 0),
    scrollX: Number(lastRaw?.scrollX || eventMeta.scrollX || 0),
    scrollY: Number(lastRaw?.scrollY || eventMeta.scrollY || 0),
    frameContext: {
      framePath: lastRaw?.framePath || eventMeta.framePath || 'top',
      frameOrigin: lastRaw?.frameOrigin || eventMeta.frameOrigin || null,
      frameOffsetX: Number(lastRaw?.frameOffsetX || eventMeta.frameOffsetX || 0),
      frameOffsetY: Number(lastRaw?.frameOffsetY || eventMeta.frameOffsetY || 0)
    },
    highlightNormalizationApplied: Boolean(normalized.ok),
    highlightFallbackReason: highlightReason || null
  };

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
    provenance
  };
}
