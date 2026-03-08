// Deterministic semantic reason mapping for checksum diff nodes.
// Priority order matters: first matching rule wins.

const RULES = [
  { test: (d) => /frame_offset_accumulation|frameTrace|frameChain|frameOffset/.test(`${d.path} ${d.stage}`), semantic: 'frame_offset_changed' },
  { test: (d) => /sourceScales\.zoom|sourceScales\.devicePixelRatio|scale_transform|dpr|zoom/.test(`${d.path} ${d.stage}`), semantic: 'scaling_changed' },
  { test: (d) => /cssTransformScale|transform/.test(`${d.path} ${d.stage}`), semantic: 'transform_changed' },
  { test: (d) => /sourceViewport|viewport_scroll|normalizedViewport|viewport/.test(`${d.path} ${d.stage}`), semantic: 'viewport_context_changed' },
  { test: (d) => /bounds_clipping|clipping|out_of_bounds|truncation/.test(`${d.path} ${d.stage} ${d.reason}`), semantic: 'clipping_changed' },
  { test: (d) => /validationTrace|validation/.test(`${d.path} ${d.stage}`), semantic: 'bounds_validation_changed' },
  { test: (d) => /finalHighlight\.fallbackReason|fallback/.test(`${d.path} ${d.reason}`), semantic: 'fallback_path_changed' },
  { test: (d) => /finalHighlight\.mode|highlightMode/.test(`${d.path} ${d.field}`), semantic: 'highlight_mode_changed' },
  { test: (d) => /finalBoxes\./.test(`${d.path}`), semantic: 'final_box_changed' },
  { test: (d) => /coordinateConfidence/.test(`${d.path} ${d.field}`), semantic: 'confidence_model_changed' },
  { test: (d) => /reasonCodes|warnings/.test(`${d.path} ${d.field}`), semantic: 'reason_code_set_changed' },
  { test: (d) => /normalizationTrace|validationTrace/.test(`${d.path}`) && /stage_(added|missing)|order_changed/.test(`${d.reason}`), semantic: 'trace_structure_changed' },
  { test: (d) => /diagnostics/.test(`${d.path}`), semantic: 'diagnostics_changed' }
];

export function semanticReasonForDiffNode(node) {
  if (!node || typeof node !== 'object') return { semanticReason: 'unclassified_change', reasonCodes: ['invalid_diff_node'] };
  const matches = RULES.filter((r) => {
    try { return r.test(node); } catch { return false; }
  });

  if (matches.length === 0) return { semanticReason: 'unclassified_change', reasonCodes: ['no_semantic_mapping'] };
  if (matches.length > 1) {
    return { semanticReason: matches[0].semantic, reasonCodes: ['ambiguous_semantic_mapping', ...matches.map((m) => `candidate:${m.semantic}`)] };
  }
  return { semanticReason: matches[0].semantic, reasonCodes: [] };
}

export function attachSemanticReasons(diff) {
  if (!diff || typeof diff !== 'object') return diff;
  const divergences = Array.isArray(diff.divergences) ? diff.divergences : [];
  const out = divergences.map((d) => {
    const mapped = semanticReasonForDiffNode(d);
    return { ...d, semanticReason: mapped.semanticReason, semanticReasonMappingNotes: mapped.reasonCodes };
  });

  const first = out[0] || null;
  const semCounts = {};
  for (const d of out) semCounts[d.semanticReason] = (semCounts[d.semanticReason] || 0) + 1;

  return {
    ...diff,
    firstDivergence: first,
    divergences: out,
    summary: {
      ...(diff.summary || {}),
      semanticReasons: semCounts
    }
  };
}
