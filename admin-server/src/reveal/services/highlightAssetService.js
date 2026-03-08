import fs from 'fs/promises';
import { assetPath, writeDataUrlAsset } from '../storage/revealStorage.js';

function isValidBox(box) {
  if (!box || typeof box !== 'object') return false;
  const x = Number(box.x);
  const y = Number(box.y);
  const w = Number(box.width);
  const h = Number(box.height);
  return [x, y, w, h].every(Number.isFinite) && w > 0 && h > 0;
}

export async function persistStepScreenshotSet({ sessionId, stepId, firstRaw, lastRaw, targetBox }) {
  const beforeFile = assetPath(sessionId, stepId, 'before');
  const afterFile = assetPath(sessionId, stepId, 'after');
  const highlightFile = assetPath(sessionId, stepId, 'highlight');

  const beforeData = firstRaw?.screenshot?.dataUrl || null;
  const afterData = lastRaw?.screenshot?.dataUrl || null;
  const highlightData = lastRaw?.highlight?.dataUrl || null;

  const beforeOk = await writeDataUrlAsset(beforeFile, beforeData);
  const afterOk = await writeDataUrlAsset(afterFile, afterData);

  let highlightOk = false;
  let highlightMode = 'fallback';
  let highlightReason = 'missing_highlight_payload';

  if (highlightData && isValidBox(targetBox)) {
    highlightOk = await writeDataUrlAsset(highlightFile, highlightData);
    highlightMode = highlightOk ? 'rendered' : 'fallback';
    highlightReason = highlightOk ? null : 'highlight_write_failed';
  } else if (!isValidBox(targetBox)) {
    highlightReason = 'invalid_or_missing_target_box';
  }

  // fallback: no rendered highlight, keep null url
  const rel = (ok, kind) => (ok ? `/reveal/storage/assets/${sessionId}/${stepId}/${kind}.jpg` : null);

  // validation for missing source assets after expected writes
  const sourceValidation = {
    beforeSourceMissing: !beforeData,
    afterSourceMissing: !afterData
  };

  if (beforeOk) await fs.access(beforeFile).catch(() => { sourceValidation.beforeSourceMissing = true; });
  if (afterOk) await fs.access(afterFile).catch(() => { sourceValidation.afterSourceMissing = true; });

  return {
    screenshots: {
      beforeUrl: rel(beforeOk, 'before'),
      afterUrl: rel(afterOk, 'after'),
      highlightedUrl: rel(highlightOk, 'highlight')
    },
    highlight: {
      mode: highlightMode,
      reason: highlightReason,
      boxValid: isValidBox(targetBox)
    },
    sourceValidation
  };
}
