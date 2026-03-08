import { getFlow } from './retrievalService.js';

function byId(steps = []) {
  return new Map(steps.map((s) => [s.id, s]));
}

function shallowEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function getFlowCompare(flowId) {
  const baselineRes = await getFlow(flowId, 'normalized');
  const reviewedRes = await getFlow(flowId, 'reviewed');

  if (!baselineRes) return { error: 'baseline_not_found' };

  const baseline = baselineRes.flow;
  const reviewed = reviewedRes?.flow || null;
  if (!reviewed) {
    return {
      baseline,
      reviewed: null,
      diff: { summary: { unchanged: 0, edited: 0, merged: 0, deleted: 0, added: 0 }, byReviewedStepId: {}, deletedBaselineStepIds: [] }
    };
  }

  const baseMap = byId(baseline.steps || []);
  const revMap = byId(reviewed.steps || []);

  const usedBaseline = new Set();
  const byReviewedStepId = {};
  let unchanged = 0;
  let edited = 0;
  let merged = 0;
  let added = 0;
  const warnings = [];

  for (const rs of reviewed.steps || []) {
    const mergedFrom = rs.metadata?.mergedFrom;
    if (Array.isArray(mergedFrom) && mergedFrom.length >= 2) {
      const allExist = mergedFrom.every((id) => baseMap.has(id));
      if (!allExist) {
        warnings.push({ type: 'unsupported_merge_state', reviewedStepId: rs.id, mergedFrom });
        byReviewedStepId[rs.id] = { state: 'merged_invalid', mergedFrom, changedFields: ['merge_reference'] };
      } else {
        merged += 1;
        mergedFrom.forEach((id) => usedBaseline.add(id));
        byReviewedStepId[rs.id] = { state: 'merged', mergedFrom, changedFields: ['title', 'events'] };
      }
      continue;
    }

    if (!baseMap.has(rs.id)) {
      added += 1;
      byReviewedStepId[rs.id] = { state: 'added', changedFields: ['new_step'] };
      continue;
    }

    usedBaseline.add(rs.id);
    const bs = baseMap.get(rs.id);
    const changedFields = [];
    if (rs.title !== bs.title) changedFields.push('title');
    if (rs.action !== bs.action) changedFields.push('action');
    if ((rs.intent || null) !== (bs.intent || null)) changedFields.push('intent');
    if ((rs.index || 0) !== (bs.index || 0)) changedFields.push('reorder');
    if (!shallowEq(rs.events || [], bs.events || [])) changedFields.push('events');

    if (changedFields.length === 0) {
      unchanged += 1;
      byReviewedStepId[rs.id] = { state: 'unchanged', changedFields: [] };
    } else {
      edited += 1;
      byReviewedStepId[rs.id] = { state: 'edited', changedFields };
    }
  }

  const deletedBaselineStepIds = (baseline.steps || [])
    .map((s) => s.id)
    .filter((id) => !usedBaseline.has(id));

  const deleted = deletedBaselineStepIds.length;

  return {
    baseline,
    reviewed,
    diff: {
      summary: { unchanged, edited, merged, deleted, added },
      byReviewedStepId,
      deletedBaselineStepIds,
      warnings
    }
  };
}
