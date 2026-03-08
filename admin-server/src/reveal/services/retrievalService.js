import { readJson, fileForNormalizedFlow, fileForReviewedFlow } from '../storage/revealStorage.js';

export async function getFlow(flowId) {
  const reviewed = await readJson(fileForReviewedFlow(flowId), null);
  if (reviewed) return { source: 'reviewed', flow: reviewed };
  const normalized = await readJson(fileForNormalizedFlow(flowId), null);
  if (normalized) return { source: 'normalized', flow: normalized };
  return null;
}
