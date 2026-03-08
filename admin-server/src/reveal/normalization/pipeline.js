import { newId, fileForNormalizedFlow, writeJson } from '../storage/revealStorage.js';
import { persistStepScreenshotSet } from '../services/highlightAssetService.js';

const GROUP_WINDOW_MS = 7000;
const TYPE_DEBOUNCE_MS = 1200;

function tsMs(ts) {
  const n = Date.parse(ts || 0);
  return Number.isFinite(n) ? n : 0;
}

function txt(v) {
  return String(v || '').trim();
}

function hasAny(str, list) {
  const s = String(str || '').toLowerCase();
  return list.some((k) => s.includes(k));
}

export function classifyElementType(event) {
  const raw = event.metadata?.raw || {};
  const t = raw.target || {};
  const tag = txt(t.tagName).toLowerCase();
  const attrs = t.attributes || {};
  const role = txt(attrs.role).toLowerCase();
  const type = txt(attrs.type).toLowerCase();
  const label = txt(t.text).toLowerCase();

  if (type === 'submit' || /submit|save|confirm|apply/.test(label)) return 'submit_action';
  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'a' || role === 'link') return 'link';
  if (type === 'search' || role === 'searchbox') return 'search_input';
  if (type === 'file') return 'upload_field';
  if (type === 'checkbox') return 'checkbox';
  if (type === 'radio') return 'radio';
  if (tag === 'select' || role === 'listbox' || role === 'combobox') return 'dropdown';
  if (tag === 'input' || tag === 'textarea') return 'text_input';
  if (role.includes('menu') || role.includes('navigation') || hasAny(label, ['menu', 'nav'])) return 'nav_item';
  if (hasAny(role, ['dialog']) || hasAny(label, ['open modal', 'close modal'])) return 'modal_trigger';
  if (hasAny(label, ['sort', 'filter', 'next page']) || hasAny(tag, ['th'])) return 'table_control';
  if (hasAny(label, ['chart', 'legend', 'series'])) return 'chart_control';
  return 'unknown';
}

function actionKind(event) {
  const type = event.type;
  const elType = event.elementType;
  if (type === 'input') return 'typing';
  if (type === 'submit') return 'submit';
  if (type === 'navigation') return 'route_change';
  if (type === 'change' && event.fileMeta) return 'upload';
  if (type === 'change') return 'selection';
  if (type === 'click' && elType === 'modal_trigger') return 'modal_toggle';
  if (type === 'click') return 'click';
  return 'other';
}

function isSignificant(event) {
  const kind = actionKind(event);
  return ['click', 'submit', 'upload', 'route_change', 'modal_toggle', 'selection'].includes(kind);
}

function routeKey(url = '') {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

function stateBoundary(prev, curr) {
  if (!prev) return false;
  const prevRoute = routeKey(prev.url);
  const currRoute = routeKey(curr.url);
  if (prevRoute !== currRoute) return true;

  const pTitle = txt(prev.metadata?.raw?.pageTitle).toLowerCase();
  const cTitle = txt(curr.metadata?.raw?.pageTitle).toLowerCase();
  if (pTitle && cTitle && pTitle !== cTitle) return true;

  const txtBlob = `${txt(curr.text)} ${txt(curr.selector)}`.toLowerCase();
  if (hasAny(txtBlob, ['success', 'completed', 'done', 'saved', 'toast'])) return true;
  if (actionKind(curr) === 'modal_toggle') return true;
  return false;
}

function collapseTyping(events = []) {
  const out = [];
  let typing = null;

  const flushTyping = () => {
    if (!typing) return;
    out.push(typing);
    typing = null;
  };

  for (const e of events) {
    if (actionKind(e) !== 'typing') {
      flushTyping();
      out.push(e);
      continue;
    }

    const key = `${e.url}|${e.selector || e.domPath || ''}`;
    const t = tsMs(e.ts);
    if (!typing) {
      typing = { ...e, _typingStart: t, _typingEnd: t, _typingCount: 1, _typingKey: key };
      continue;
    }

    if (typing._typingKey === key && (t - typing._typingEnd) <= TYPE_DEBOUNCE_MS) {
      typing._typingEnd = t;
      typing._typingCount += 1;
      typing.id = `${typing.id},${e.id}`;
      typing.metadata = {
        ...(typing.metadata || {}),
        typingCollapsed: true,
        typingCount: typing._typingCount
      };
    } else {
      flushTyping();
      typing = { ...e, _typingStart: t, _typingEnd: t, _typingCount: 1, _typingKey: key };
    }
  }
  flushTyping();
  return out;
}

export function cleanEvents(rawEvents = []) {
  const base = rawEvents
    .filter((e) => e?.type && e?.url)
    .map((e) => ({ ...e, elementType: classifyElementType(e) }))
    .sort((a, b) => tsMs(a.ts) - tsMs(b.ts));

  return collapseTyping(base);
}

function canCompound(group, curr) {
  const types = new Set(group.map((g) => actionKind(g)));
  const k = actionKind(curr);

  if (types.has('click') && k === 'upload') return true;
  if (types.has('upload') && (k === 'submit' || k === 'click')) return true;
  if (types.has('selection') && (k === 'click' || k === 'submit')) return true;
  if (types.has('click') && k === 'selection') return true;
  return false;
}

export function groupEvents(events = []) {
  const groups = [];
  let current = [];
  let last = null;

  const flush = () => {
    if (current.length) groups.push(current);
    current = [];
    last = null;
  };

  for (const e of events) {
    if (!current.length) {
      current.push(e);
      last = e;
      continue;
    }

    const delta = tsMs(e.ts) - tsMs(last.ts);
    const boundary = stateBoundary(last, e);
    const significantBoundary = isSignificant(last) && isSignificant(e) && !canCompound(current, e) && delta > 1200;

    if (boundary || delta > GROUP_WINDOW_MS || significantBoundary) {
      flush();
    }

    current.push(e);
    last = e;
  }

  flush();
  return groups;
}

function inferAction(group) {
  const kinds = group.map(actionKind);
  if (kinds.includes('upload')) return 'upload';
  if (kinds.includes('submit')) return 'submit';
  if (kinds.includes('route_change')) return 'navigate';
  if (kinds.includes('selection') && kinds.includes('click')) return 'apply';
  if (kinds.includes('typing')) return 'enter';
  if (kinds.includes('click')) return 'click';
  return 'action';
}

function bestTarget(group) {
  const pick = [...group].reverse().find((e) => txt(e.text)) || [...group].find((e) => txt(e.text)) || group[0];
  return {
    selector: pick?.selector || null,
    domPath: pick?.domPath || null,
    text: pick?.text || null,
    role: pick?.metadata?.raw?.target?.attributes?.role || null,
    elementType: pick?.elementType || 'unknown',
    tagName: pick?.metadata?.raw?.target?.tagName || null,
    attributes: pick?.metadata?.raw?.target?.attributes || {},
    elementBox: pick?.elementBox || null
  };
}

function titleFor(action, target, group) {
  const label = txt(target.text).replace(/\s+/g, ' ').slice(0, 60) || 'Target';
  const attrs = target.attributes || {};

  if (action === 'enter') {
    const field = txt(attrs['aria-label'] || attrs.name || attrs.placeholder || label || 'Field');
    if (target.elementType === 'search_input') return `Search ${field}`;
    return `Enter ${field}`;
  }
  if (action === 'upload') {
    const fileEvt = group.find((e) => e.fileMeta?.[0]);
    const ext = fileEvt?.fileMeta?.[0]?.name?.split('.').pop();
    return ext ? `Upload ${ext.toUpperCase()} File` : 'Upload File';
  }
  if (action === 'submit') {
    const formName = txt(attrs.name || attrs['aria-label'] || label || 'Form');
    return `Submit ${formName}`;
  }
  if (action === 'apply') return `Apply ${label}`;
  if (action === 'navigate') return `Open ${label}`;
  return `Click ${label}`;
}

function scoreStep({ target, group, title, action }) {
  let s = 0.45;
  if (txt(target.text)) s += 0.15;
  if (target.elementType && target.elementType !== 'unknown') s += 0.15;
  if (group.some((e) => actionKind(e) === 'route_change')) s += 0.1;
  if (group.length >= 2 && group.length <= 5) s += 0.08;
  if (/^(Click|Open|Enter|Search|Upload|Submit|Apply) /.test(title)) s += 0.07;
  if (['upload', 'submit', 'apply', 'navigate', 'enter'].includes(action)) s += 0.05;
  return Number(Math.max(0.2, Math.min(0.99, s)).toFixed(2));
}


export async function normalizeSessionToFlow({ session, events }) {
  const cleaned = cleanEvents(events);
  const grouped = groupEvents(cleaned);

  const steps = [];
  for (let i = 0; i < grouped.length; i += 1) {
    const group = grouped[i];
    const action = inferAction(group);
    const target = bestTarget(group);
    const title = titleFor(action, target, group);
    const stepId = newId('step');
    const firstRaw = group.find((e) => e.metadata?.raw?.screenshot?.dataUrl)?.metadata?.raw || null;
    const lastRaw = [...group].reverse().find((e) => e.metadata?.raw?.screenshot?.dataUrl)?.metadata?.raw || null;
    const persistedShots = await persistStepScreenshotSet({
      sessionId: session.sessionId,
      stepId,
      firstRaw,
      lastRaw,
      targetBox: target?.elementBox || null
    });

    const screenshots = persistedShots.screenshots;
    const first = group[0];
    const step = {
      id: stepId,
      index: i + 1,
      title,
      action,
      intent: null,
      target,
      page: {
        url: first?.url || '',
        title: first?.metadata?.raw?.pageTitle || null,
        routeKey: routeKey(first?.url || '')
      },
      screenshots,
      events: group.flatMap((e) => String(e.id || '').split(',').filter(Boolean)),
      confidence: scoreStep({ target, group, title, action }),
      metadata: {
        groupedEventCount: group.length,
        significantActions: group.filter((e) => isSignificant(e)).length,
        rulesApplied: ['typing_debounce_v1', 'state_boundary_split_v1', 'compound_grouping_v1', 'title_generator_v1', 'confidence_v1'],
        highlightMode: persistedShots.highlight.mode,
        highlightFallbackReason: persistedShots.highlight.reason,
        screenshotSourceValidation: persistedShots.sourceValidation
      },
      annotations: []
    };

    steps.push(step);
  }

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
    steps,
    rawEventCount: cleaned.length,
    version: 1
  };

  await writeJson(fileForNormalizedFlow(flow.id), flow);
  return flow;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}
