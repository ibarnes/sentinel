export function scoreCoordinateConfidence({ normalized, validation, provenance, highlightMode, driftWarning }) {
  let score = 0.35;
  const codes = [];

  if (normalized?.ok) {
    score += 0.2;
    codes.push('normalized_ok');
  } else {
    codes.push('missing_box');
  }

  if (validation?.ok) {
    score += 0.15;
    codes.push('in_bounds_valid');
  }

  if (provenance?.devicePixelRatio) {
    score += 0.08;
    codes.push('dpr_known');
  }

  if (provenance?.frameContext?.frameChainComplete) {
    score += 0.08;
    codes.push('frame_chain_complete');
  } else {
    codes.push('frame_chain_partial');
    score -= 0.06;
  }

  if (provenance?.zoom) {
    score += 0.05;
    codes.push('zoom_known');
  }

  if (provenance?.cssTransformScale && provenance.cssTransformScale !== 1) {
    codes.push('transform_estimated');
    score -= 0.04;
  }

  if (driftWarning) {
    codes.push('drift_warning');
    score -= 0.1;
  } else {
    codes.push('exact_projection_or_low_drift');
    score += 0.05;
  }

  if (highlightMode === 'rendered') {
    score += 0.08;
    codes.push('highlight_rendered');
  } else {
    score -= 0.08;
    codes.push('fallback_highlight');
  }

  const finalScore = Number(Math.max(0, Math.min(1, score)).toFixed(2));
  return { coordinateConfidence: finalScore, coordinateConfidenceReasonCodes: codes };
}

export function buildViewportDiagnostics({ normalized, validation, screenshotMeta, projectedBox }) {
  const d = {
    viewportMismatch: false,
    imageDimensionMismatch: false,
    frameOffsetMismatch: false,
    normalizationTruncation: false,
    outOfBoundsClipping: false,
    validationReason: validation?.ok ? null : validation?.reason || null,
    projectedBox,
    normalizedViewport: normalized?.box?.normalizedViewport || null,
    sourceViewport: normalized?.box?.sourceViewport || null,
    renderedImageDimensions: screenshotMeta ? { width: screenshotMeta.width || 0, height: screenshotMeta.height || 0 } : null
  };

  if (normalized?.ok) {
    const sv = normalized.box.sourceViewport;
    const nv = normalized.box.normalizedViewport;
    d.viewportMismatch = Math.abs((sv.width || 0) - (nv.width || 0)) > Math.max(4, (sv.width || 0) * 0.5);
    d.imageDimensionMismatch = Math.abs((screenshotMeta?.width || 0) - (nv.width || 0)) > 3 || Math.abs((screenshotMeta?.height || 0) - (nv.height || 0)) > 3;
    d.frameOffsetMismatch = normalized.box.frameChainImpossible === true;

    const b = normalized.box;
    d.normalizationTruncation = b.x === 0 || b.y === 0 || (b.x + b.width) >= (nv.width - 1) || (b.y + b.height) >= (nv.height - 1);
    d.outOfBoundsClipping = !validation?.ok && ['box_out_of_bounds','origin_out_of_bounds','negative_coordinates'].includes(validation?.reason || '');
  }

  return d;
}
