import { newId, fileForNormalizedFlow, writeJson } from '../storage/revealStorage.js';

export function classifyElementType(event) {
  const tag = String(event.metadata?.raw?.target?.tagName || '').toLowerCase();
  const attrs = event.metadata?.raw?.target?.attributes || {};
  const role = String(attrs.role || '').toLowerCase();

  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'form') return 'form';
  if (role.includes('menu') || role.includes('navigation')) return 'navigation_menu';
  if (role === 'dialog') return 'modal';
  if (tag === 'table') return 'table';
  if (attrs.type === 'file') return 'upload_field';
  if (attrs.type === 'search') return 'search_input';
  if (tag === 'input' || tag === 'textarea') return 'input';
  return 'unknown';
}

export function cleanEvents(rawEvents = []) {
  return rawEvents.filter((e) => e?.type && e?.url).map((e) => ({ ...e, elementType: classifyElementType(e) }));
}

export function groupEvents(events = []) {
  // Placeholder grouping with simple burst merge window.
  const groups = [];
  let current = [];
  let lastTs = 0;
  for (const e of events) {
    const ts = Date.parse(e.ts || 0);
    if (!current.length || (ts - lastTs) <= 8000) {
      current.push(e);
    } else {
      groups.push(current);
      current = [e];
    }
    lastTs = ts;
  }
  if (current.length) groups.push(current);
  return groups;
}

export function inferStep(group = []) {
  const first = group[0];
  const last = group[group.length - 1];
  const action = first?.type || 'unknown';

  // Phase-1 deterministic placeholders
  // - debounce typing into field-entry step
  // - merge burst events into compound step
  // - detect form submission boundaries
  // - split on route/modal/completion events
  const title = generateTitle(group);

  return {
    id: newId('step'),
    index: 0,
    title,
    action,
    intent: null,
    target: {
      selector: first?.selector || null,
      domPath: first?.domPath || null,
      text: first?.text || null,
      role: first?.metadata?.raw?.target?.attributes?.role || null,
      elementType: first?.elementType || 'unknown',
      tagName: first?.metadata?.raw?.target?.tagName || null,
      attributes: first?.metadata?.raw?.target?.attributes || {},
      elementBox: first?.elementBox || null
    },
    page: {
      url: first?.url || '',
      title: first?.metadata?.raw?.pageTitle || null,
      routeKey: routeKey(first?.url || '')
    },
    screenshots: {
      beforeUrl: null,
      afterUrl: null,
      highlightedUrl: null
    },
    events: group.map((e) => e.id),
    confidence: 0.6,
    metadata: {
      groupedEventCount: group.length,
      rulesApplied: ['burst_grouping_v1', 'element_classifier_v1']
    },
    annotations: [],
    _lastTs: last?.ts || first?.ts || null
  };
}

export function generateTitle(group = []) {
  const first = group[0] || {};
  const t = first.text || first.selector || first.type || 'interaction';
  if (first.type === 'input') return `Enter ${t}`;
  if (first.type === 'submit') return `Submit ${t}`;
  if (first.type === 'navigation') return `Navigate ${t}`;
  if (first.type === 'change' && first.fileMeta) return `Upload file`;
  return `Click ${t}`;
}

export function routeKey(url = '') {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

export async function normalizeSessionToFlow({ session, events }) {
  const cleaned = cleanEvents(events);
  const grouped = groupEvents(cleaned);
  const steps = grouped.map((g, idx) => ({ ...inferStep(g), index: idx + 1 }));

  const flow = {
    id: newId('flow'),
    sessionId: session.sessionId,
    name: `Captured Flow ${session.sessionId}`,
    description: 'Auto-generated from Reveal capture session',
    appHost: safeHost(cleaned[0]?.url || ''),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdBy: 'reveal-capture',
    status: 'draft',
    steps: steps.map(({ _lastTs, ...rest }) => rest),
    rawEventCount: cleaned.length,
    version: 1
  };

  await writeJson(fileForNormalizedFlow(flow.id), flow);
  return flow;
}

function safeHost(url) {
  try { return new URL(url).host; } catch { return 'unknown'; }
}
