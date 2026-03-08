// Semantic mapping philosophy:
// 1) Determine broad semanticReason from path/stage/field/reason
// 2) Determine semanticSubReason using semantic-specific rules
// 3) Preserve raw reason/path always; semantic layers are additive
// 4) Deterministic first-match priority

const SEMANTIC_RULES = [
  { test: (d) => /frame_offset_accumulation|frameTrace|frameChain|frameOffset/.test(`${d.path} ${d.stage}`), semantic: 'frame_offset_changed' },
  { test: (d) => /sourceScales\.zoom|sourceScales\.devicePixelRatio|scale_transform|dpr|zoom/.test(`${d.path} ${d.stage}`), semantic: 'scaling_changed' },
  { test: (d) => /cssTransformScale|transform/.test(`${d.path} ${d.stage}`), semantic: 'transform_changed' },
  { test: (d) => /sourceViewport|viewport_scroll|normalizedViewport|viewport/.test(`${d.path} ${d.stage}`), semantic: 'viewport_context_changed' },
  { test: (d) => /bounds_clipping|clipping|out_of_bounds|truncation/.test(`${d.path} ${d.stage} ${d.reason}`), semantic: 'clipping_changed' },
  { test: (d) => /validationTrace|validation/.test(`${d.path} ${d.stage}`), semantic: 'bounds_validation_changed' },
  { test: (d) => /finalHighlight\.fallbackReason|fallback/.test(`${d.path} ${d.reason}`), semantic: 'fallback_path_changed' },
  { test: (d) => /finalHighlight\.mode|highlightMode/.test(`${d.path} ${d.field}`), semantic: 'highlight_mode_changed' },
  { test: (d) => /finalBoxes\./.test(`${d.path}`), semantic: 'final_box_changed' },
  { test: (d) => /coordinateConfidence|confidence/.test(`${d.path} ${d.field}`), semantic: 'confidence_model_changed' },
  { test: (d) => /reasonCodes|warnings/.test(`${d.path} ${d.field}`), semantic: 'reason_code_set_changed' },
  { test: (d) => /normalizationTrace|validationTrace/.test(`${d.path}`) && /stage_(added|missing)|order_changed/.test(`${d.reason}`), semantic: 'trace_structure_changed' }
];

const SUB_RULES = {
  scaling_changed: [
    { test: (d) => /devicePixelRatio|dpr/.test(`${d.path} ${d.field}`), sub: 'dpr_delta' },
    { test: (d) => /zoom/.test(`${d.path} ${d.field}`), sub: 'zoom_delta' },
    { test: (d) => /cssTransformScale|transform/.test(`${d.path} ${d.stage}`), sub: 'css_transform_delta' },
    { test: (d) => true, sub: 'multi_scale_delta' }
  ],
  frame_offset_changed: [
    { test: (d) => /frameChain/.test(`${d.path}`), sub: 'frame_chain_delta' },
    { test: (d) => /frame_offset_accumulation|frameOffset/.test(`${d.path} ${d.stage}`), sub: 'accumulated_offset_delta' },
    { test: (d) => /partial|unresolved/.test(`${d.path} ${d.reason}`), sub: 'partial_frame_chain_delta' },
    { test: (d) => /frameOrigin/.test(`${d.path}`), sub: 'frame_origin_context_delta' }
  ],
  viewport_context_changed: [
    { test: (d) => /viewportWidth|viewportHeight|normalizedViewport|sourceViewport/.test(`${d.path}`), sub: 'viewport_dimension_delta' },
    { test: (d) => /scrollX|scrollY|scroll/.test(`${d.path} ${d.field}`), sub: 'scroll_offset_delta' },
    { test: (d) => true, sub: 'viewport_source_delta' }
  ],
  clipping_changed: [
    { test: (d) => /out_of_bounds/.test(`${d.reason} ${d.path}`), sub: 'out_of_bounds_delta' },
    { test: (d) => /clamp|bounds_clipping/.test(`${d.path} ${d.stage}`), sub: 'clamp_delta' },
    { test: (d) => true, sub: 'truncation_delta' }
  ],
  bounds_validation_changed: [
    { test: (d) => /validationTrace/.test(`${d.path}`), sub: 'validation_path_delta' },
    { test: (d) => /threshold|min|max/.test(`${d.path} ${d.field}`), sub: 'validation_threshold_delta' },
    { test: (d) => /storedValue":true|currentValue":false/.test(JSON.stringify(d)), sub: 'bounds_pass_to_fail' },
    { test: (d) => /storedValue":false|currentValue":true/.test(JSON.stringify(d)), sub: 'bounds_fail_to_pass' }
  ],
  fallback_path_changed: [
    { test: (d) => /fallbackReason/.test(`${d.path}`), sub: 'fallback_reason_delta' },
    { test: (d) => d.storedValue === 'rendered' || d.currentValue === 'fallback', sub: 'rendered_to_fallback' },
    { test: (d) => d.storedValue === 'fallback' || d.currentValue === 'rendered', sub: 'fallback_to_rendered' }
  ],
  highlight_mode_changed: [
    { test: () => true, sub: 'highlight_render_mode_delta' }
  ],
  final_box_changed: [
    { test: (d) => /finalBoxes\.normalizedBox/.test(`${d.path}`), sub: 'normalized_box_delta' },
    { test: (d) => /finalBoxes\.renderedBox/.test(`${d.path}`), sub: 'rendered_box_delta' },
    { test: (d) => /finalBoxes\.projectedBox/.test(`${d.path}`), sub: 'projected_box_delta' }
  ],
  confidence_model_changed: [
    { test: (d) => /coordinateConfidence/.test(`${d.path}`), sub: 'confidence_score_delta' },
    { test: (d) => /reasonCodes/.test(`${d.path}`), sub: 'confidence_reason_code_delta' }
  ],
  reason_code_set_changed: [
    { test: (d) => /warnings/.test(`${d.path}`), sub: 'warning_set_delta' },
    { test: (d) => Array.isArray(d.storedValue) && Array.isArray(d.currentValue) && (d.currentValue.length > d.storedValue.length), sub: 'reason_code_added' },
    { test: (d) => Array.isArray(d.storedValue) && Array.isArray(d.currentValue) && (d.currentValue.length < d.storedValue.length), sub: 'reason_code_removed' }
  ],
  trace_structure_changed: [
    { test: (d) => d.reason === 'stage_added', sub: 'stage_added_delta' },
    { test: (d) => d.reason === 'stage_missing', sub: 'stage_removed_delta' },
    { test: (d) => d.reason === 'order_changed', sub: 'stage_order_delta' }
  ]
};

export function semanticReasonForDiffNode(node) {
  if (!node || typeof node !== 'object') return { semanticReason: 'unclassified_change', mappingNotes: ['invalid_diff_node'] };
  const matches = SEMANTIC_RULES.filter((r) => { try { return r.test(node); } catch { return false; } });
  if (!matches.length) return { semanticReason: 'unclassified_change', mappingNotes: ['no_semantic_mapping'] };
  if (matches.length > 1) return { semanticReason: matches[0].semantic, mappingNotes: ['ambiguous_semantic_mapping', ...matches.map((m) => `candidate:${m.semantic}`)] };
  return { semanticReason: matches[0].semantic, mappingNotes: [] };
}

export function semanticSubReasonForDiffNode(node, semanticReason) {
  const rules = SUB_RULES[semanticReason] || [];
  const matches = rules.filter((r) => { try { return r.test(node); } catch { return false; } });
  if (!matches.length) return { semanticSubReason: null, mappingNotes: ['no_subreason_mapping'] };
  if (matches.length > 1) return { semanticSubReason: matches[0].sub, mappingNotes: ['ambiguous_subreason_mapping', ...matches.map((m) => `candidate:${m.sub}`)] };
  return { semanticSubReason: matches[0].sub, mappingNotes: [] };
}

export function attachSemanticReasons(diff) {
  if (!diff || typeof diff !== 'object') return diff;
  const divergences = Array.isArray(diff.divergences) ? diff.divergences : [];
  const out = divergences.map((d) => {
    const sem = semanticReasonForDiffNode(d);
    const sub = semanticSubReasonForDiffNode(d, sem.semanticReason);
    return {
      ...d,
      semanticReason: sem.semanticReason,
      semanticSubReason: sub.semanticSubReason,
      semanticReasonMappingNotes: sem.mappingNotes,
      semanticSubReasonMappingNotes: sub.mappingNotes
    };
  });

  const first = out[0] || null;
  const semCounts = {};
  const subCounts = {};
  for (const d of out) {
    semCounts[d.semanticReason] = (semCounts[d.semanticReason] || 0) + 1;
    if (d.semanticSubReason) subCounts[d.semanticSubReason] = (subCounts[d.semanticSubReason] || 0) + 1;
  }

  return {
    ...diff,
    firstDivergence: first,
    divergences: out,
    summary: {
      ...(diff.summary || {}),
      semanticReasons: semCounts,
      semanticSubReasons: subCounts
    }
  };
}
