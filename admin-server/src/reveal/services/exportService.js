import { getFlow } from './retrievalService.js';
import { getSnapshot } from './snapshotService.js';

function stepTargetSummary(step) {
  return `${step.target?.elementType || 'unknown'}:${step.target?.text || step.target?.selector || 'n/a'}`;
}

function stepPageSummary(step) {
  return `${step.page?.url || 'n/a'}${step.page?.routeKey ? ` (${step.page.routeKey})` : ''}`;
}

function toMarkdown(flow, meta = {}) {
  const lines = [];
  lines.push(`# ${flow.name || 'Reviewed Flow'}`);
  if (flow.description) lines.push('', flow.description);
  lines.push('', `- App Host: ${flow.appHost || 'unknown'}`);
  if (meta.snapshotId) lines.push(`- Snapshot ID: ${meta.snapshotId}`);
  lines.push(`- Review Version: ${flow.reviewVersion || flow.version || 1}`);
  lines.push(`- Steps: ${(flow.steps || []).length}`);
  lines.push('', '## Steps');

  for (const s of flow.steps || []) {
    lines.push(``, `### ${s.index}. ${s.title}`);
    lines.push(`- Action: ${s.action}`);
    lines.push(`- Intent: ${s.intent || 'n/a'}`);
    lines.push(`- Target: ${stepTargetSummary(s)}`);
    lines.push(`- Page: ${stepPageSummary(s)}`);
    lines.push(`- Confidence: ${s.confidence ?? 'n/a'}`);
    if ((s.annotations || []).length) {
      lines.push(`- Annotations:`);
      for (const a of s.annotations) lines.push(`  - ${a.author || 'author'}: ${a.text}`);
    }
  }
  return lines.join('\n') + '\n';
}

export async function exportReviewedFlow(flowId, format = 'json') {
  const found = await getFlow(flowId, 'preferred');
  if (!found) return { error: 'flow_not_found' };
  const flow = found.flow;

  if (format === 'json') return { contentType: 'application/json', filename: `${flowId}-reviewed.json`, content: JSON.stringify(flow, null, 2) };
  if (format === 'markdown') return { contentType: 'text/markdown; charset=utf-8', filename: `${flowId}-reviewed.md`, content: toMarkdown(flow) };
  return { error: 'invalid_export_format' };
}

export async function exportSnapshot(flowId, snapshotId, format = 'json') {
  const got = await getSnapshot(flowId, snapshotId);
  if (got.error) return got;
  const snapshot = got.snapshot;

  if (format === 'json') return { contentType: 'application/json', filename: `${flowId}-${snapshotId}.json`, content: JSON.stringify(snapshot, null, 2) };
  if (format === 'markdown') return { contentType: 'text/markdown; charset=utf-8', filename: `${flowId}-${snapshotId}.md`, content: toMarkdown(snapshot.reviewedFlow, { snapshotId }) };
  return { error: 'invalid_export_format' };
}
