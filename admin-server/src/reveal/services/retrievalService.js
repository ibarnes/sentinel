import { readJson, fileForNormalizedFlow, fileForReviewedFlow } from '../storage/revealStorage.js';

export async function getFlow(flowId, version = 'preferred') {
  const v = String(version || 'preferred').toLowerCase();

  if (v === 'normalized') {
    const flow = await readJson(fileForNormalizedFlow(flowId), null);
    return flow ? { source: 'normalized', flow } : null;
  }

  if (v === 'reviewed') {
    const flow = await readJson(fileForReviewedFlow(flowId), null);
    return flow ? { source: 'reviewed', flow } : null;
  }

  const reviewed = await readJson(fileForReviewedFlow(flowId), null);
  if (reviewed) return { source: 'reviewed', flow: reviewed };

  const normalized = await readJson(fileForNormalizedFlow(flowId), null);
  if (normalized) return { source: 'normalized', flow: normalized };

  return null;
}
