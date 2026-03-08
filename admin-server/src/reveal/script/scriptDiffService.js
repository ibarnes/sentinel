function secKey(section) { return section?.sectionId || `idx_${section?.stepIndex ?? 'x'}`; }

export function computeScriptDiff(baseline, reviewed) {
  const bSecs = baseline?.sections || [];
  const rSecs = reviewed?.sections || [];
  const byId = {};
  let changedSectionCount = 0;
  let firstDivergence = null;

  const bIndexById = new Map(bSecs.map((s, i) => [secKey(s), i]));

  for (let i = 0; i < rSecs.length; i += 1) {
    const r = rSecs[i];
    const id = secKey(r);
    const bi = bIndexById.get(id);
    const b = bi == null ? null : bSecs[bi];

    const changedFields = [];
    let state = 'unchanged';

    if (!b) {
      state = 'edited';
      changedFields.push('added_section');
    } else {
      if ((r.narrationText || '') !== (b.narrationText || '')) changedFields.push('narrationText');
      if ((r.onScreenText || '') !== (b.onScreenText || '')) changedFields.push('onScreenText');
      if (Number(r.timing?.estimatedDurationMs || 0) !== Number(b.timing?.estimatedDurationMs || 0)
        || Number(r.timing?.leadInMs || 0) !== Number(b.timing?.leadInMs || 0)
        || Number(r.timing?.leadOutMs || 0) !== Number(b.timing?.leadOutMs || 0)) changedFields.push('timing');
      if ((r.notes || '') !== (b.notes || '')) changedFields.push('notes');
      if ((r.annotations || []).length > (b.annotations || []).length) changedFields.push('annotations');
      if (bi !== i) changedFields.push('reordered');

      if (changedFields.includes('reordered') && changedFields.length === 1) state = 'reordered';
      else if (changedFields.includes('annotations') && changedFields.length === 1) state = 'note_added';
      else if (changedFields.length > 0) state = 'edited';
    }

    if (state !== 'unchanged') {
      changedSectionCount += 1;
      if (!firstDivergence) firstDivergence = { sectionId: id, stepIndex: r.stepIndex, state, changedFields };
    }

    byId[id] = { state, changedFields };
  }

  if ((reviewed?.reviewStatus || 'draft') !== 'draft') {
    if (!firstDivergence) firstDivergence = { sectionId: null, stepIndex: null, state: 'edited', changedFields: ['reviewStatus'] };
  }

  return {
    changedSectionCount,
    firstDivergence,
    sections: byId
  };
}
