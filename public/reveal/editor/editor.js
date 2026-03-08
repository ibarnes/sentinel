let state = {
  flowId: null,
  flow: null,
  baseline: null,
  reviewed: null,
  compare: null,
  compareMode: true,
  selectedStepId: null,
  selectedForMerge: new Set()
};

async function api(path, method = 'GET', body) {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${method} ${path} failed`);
  return j;
}

async function initReview(flowId) {
  await api(`/reveal/api/flows/${encodeURIComponent(flowId)}/review/init`, 'POST', {});
}

async function loadCompare(flowId) {
  return api(`/reveal/api/flows/${encodeURIComponent(flowId)}/compare`);
}

function diffInfo(stepId) {
  return state.compare?.diff?.byReviewedStepId?.[stepId] || { state: 'unknown', changedFields: [] };
}

function badge(text, cls = 'neutral') {
  return `<span class="b b-${cls}">${escapeHtml(text)}</span>`;
}

function renderTimeline() {
  const flow = state.reviewed || state.flow;
  const ul = document.getElementById('timeline-list');
  ul.innerHTML = '';

  (flow.steps || []).forEach((step, idx) => {
    const li = document.createElement('li');
    li.dataset.stepId = step.id;

    const shotCount = [step.screenshots?.beforeUrl, step.screenshots?.afterUrl, step.screenshots?.highlightedUrl].filter(Boolean).length;
    const d = diffInfo(step.id);
    const diffBadge = badge(d.state || 'unknown', d.state === 'edited' ? 'warn' : d.state === 'merged' ? 'info' : d.state === 'unchanged' ? 'ok' : 'neutral');
    const hiMode = step.metadata?.highlightMode || 'fallback';

    li.innerHTML = `<label><input type="checkbox" data-merge="${step.id}" /> ${idx + 1}. ${escapeHtml(step.title)}</label>
      <div class="step-trust">
        ${diffBadge}
        ${badge(`conf ${(step.confidence ?? 0).toFixed(2)}`, 'info')}
        ${badge(step.target?.elementType || 'unknown', 'neutral')}
        ${badge(`shots ${shotCount}/3`, shotCount >= 2 ? 'ok' : 'warn')}
        ${badge(`hl ${hiMode}`, hiMode === 'rendered' ? 'ok' : 'warn')}
        ${badge(`events ${(step.events || []).length}`, 'neutral')}
      </div>`;

    li.addEventListener('click', (e) => {
      if (e.target?.matches('input[type=checkbox]')) return;
      state.selectedStepId = step.id;
      showStep(step);
      highlightSelected();
    });
    ul.appendChild(li);
  });

  ul.querySelectorAll('input[data-merge]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const id = cb.getAttribute('data-merge');
      if (cb.checked) state.selectedForMerge.add(id);
      else state.selectedForMerge.delete(id);
    });
  });

  const deleted = state.compare?.diff?.deletedBaselineStepIds || [];
  if (deleted.length) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Deleted from baseline:</strong> ${deleted.length} step(s)`;
    ul.appendChild(li);
  }

  if (!state.selectedStepId && flow.steps?.length) state.selectedStepId = flow.steps[0].id;
  const step = flow.steps?.find((s) => s.id === state.selectedStepId) || flow.steps?.[0];
  if (step) showStep(step);
  highlightSelected();
}

function highlightSelected() {
  document.querySelectorAll('#timeline-list li').forEach((li) => {
    li.classList.toggle('active', li.dataset.stepId === state.selectedStepId);
  });
}

function baselineFor(step) {
  if (!state.baseline) return null;
  const mergedFrom = step.metadata?.mergedFrom;
  if (Array.isArray(mergedFrom) && mergedFrom.length) {
    return (state.baseline.steps || []).filter((s) => mergedFrom.includes(s.id));
  }
  const single = (state.baseline.steps || []).find((s) => s.id === step.id);
  return single ? [single] : [];
}

function showStep(step) {
  state.selectedStepId = step.id;
  const shotCount = [step.screenshots?.beforeUrl, step.screenshots?.afterUrl, step.screenshots?.highlightedUrl].filter(Boolean).length;
  document.getElementById('step-title').textContent = step.title || 'Step';
  document.getElementById('step-meta').textContent = `${step.action} • ${step.page?.url || ''} • confidence ${Number(step.confidence ?? 0).toFixed(2)} • type ${step.target?.elementType || 'unknown'} • screenshots ${shotCount}/3 • raw events ${(step.events || []).length} • highlight ${step.metadata?.highlightMode || 'fallback'}`;

  document.getElementById('shot-before').src = step.screenshots?.beforeUrl || '';
  document.getElementById('shot-after').src = step.screenshots?.afterUrl || '';
  document.getElementById('shot-highlight').src = step.screenshots?.highlightedUrl || '';

  const ann = document.getElementById('annotations');
  ann.innerHTML = '';
  (step.annotations || []).forEach((a) => {
    const li = document.createElement('li');
    li.textContent = `${a.author}: ${a.text}`;
    ann.appendChild(li);
  });

  renderComparePanel(step);
}

function renderComparePanel(step) {
  const panel = document.getElementById('compare-panel');
  if (!panel) return;
  if (!state.compareMode) {
    panel.innerHTML = '';
    return;
  }

  const d = diffInfo(step.id);
  const base = baselineFor(step);

  if (!base || base.length === 0) {
    panel.innerHTML = `<div class="cmp"><strong>Compare:</strong> no baseline step match (${escapeHtml(d.state)})</div>`;
    return;
  }

  const changed = (d.changedFields || []).join(', ') || 'none';
  const baselineBlock = base.map((b) => `<div class="cmp-col"><h4>Baseline</h4><div>title: ${escapeHtml(b.title || '')}</div><div>action: ${escapeHtml(b.action || '')}</div><div>intent: ${escapeHtml(b.intent || '')}</div><div>index: ${b.index}</div></div>`).join('');
  panel.innerHTML = `<div class="cmp"><div class="cmp-col"><h4>Reviewed</h4><div>title: ${escapeHtml(step.title || '')}</div><div>action: ${escapeHtml(step.action || '')}</div><div>intent: ${escapeHtml(step.intent || '')}</div><div>index: ${step.index}</div><div>diff: ${escapeHtml(d.state)} (${escapeHtml(changed)})</div></div>${baselineBlock}</div>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function refresh() {
  const data = await loadCompare(state.flowId);
  state.compare = data;
  state.baseline = data.baseline;
  state.reviewed = data.reviewed || data.baseline;
  state.flow = state.reviewed;
  renderTimeline();
}

function selectedStep() {
  return (state.flow?.steps || []).find((s) => s.id === state.selectedStepId);
}

async function renameStep() {
  const step = selectedStep();
  if (!step) return;
  const title = prompt('Rename step', step.title || '');
  if (title == null) return;
  await api(`/reveal/api/flows/${state.flowId}/steps/${step.id}`, 'PATCH', { title });
  await refresh();
}

async function deleteStep() {
  const step = selectedStep();
  if (!step) return;
  if (!confirm(`Delete step: ${step.title}?`)) return;
  await api(`/reveal/api/flows/${state.flowId}/steps/${step.id}`, 'DELETE');
  state.selectedStepId = null;
  await refresh();
}

async function annotateStep() {
  const step = selectedStep();
  if (!step) return;
  const text = prompt('Add annotation');
  if (!text) return;
  await api(`/reveal/api/flows/${state.flowId}/steps/${step.id}/annotations`, 'POST', { author: 'reviewer', text });
  await refresh();
}

async function reorder(direction) {
  const steps = state.flow?.steps || [];
  const idx = steps.findIndex((s) => s.id === state.selectedStepId);
  if (idx < 0) return;
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (target < 0 || target >= steps.length) return;

  const ids = steps.map((s) => s.id);
  [ids[idx], ids[target]] = [ids[target], ids[idx]];
  await api(`/reveal/api/flows/${state.flowId}/steps/reorder`, 'POST', { orderedStepIds: ids });
  await refresh();
}

async function mergeSelected() {
  const stepIds = [...state.selectedForMerge];
  if (stepIds.length < 2) {
    alert('Select at least 2 steps to merge.');
    return;
  }
  const title = prompt('Merged step title (optional)', 'Merged Step') || undefined;
  await api(`/reveal/api/flows/${state.flowId}/steps/merge`, 'POST', { stepIds, merge: { title } });
  state.selectedForMerge.clear();
  await refresh();
}

function wireActions() {
  document.querySelector('[data-action="rename"]')?.addEventListener('click', renameStep);
  document.querySelector('[data-action="delete"]')?.addEventListener('click', deleteStep);
  document.querySelector('[data-action="annotate"]')?.addEventListener('click', annotateStep);
  document.querySelector('[data-action="reload"]')?.addEventListener('click', refresh);
  document.querySelector('[data-action="move-up"]')?.addEventListener('click', () => reorder('up'));
  document.querySelector('[data-action="move-down"]')?.addEventListener('click', () => reorder('down'));
  document.querySelector('[data-action="merge"]')?.addEventListener('click', mergeSelected);
  document.querySelector('[data-action="compare-toggle"]')?.addEventListener('click', (e) => {
    state.compareMode = !state.compareMode;
    e.target.textContent = `Compare: ${state.compareMode ? 'On' : 'Off'}`;
    const step = selectedStep();
    if (step) renderComparePanel(step);
  });
}

async function boot() {
  const root = document.getElementById('reveal-editor');
  state.flowId = root?.dataset?.flowId;
  if (!state.flowId) return;
  try {
    await initReview(state.flowId);
    await refresh();
    wireActions();
  } catch (e) {
    document.getElementById('step-title').textContent = 'Unable to load flow';
    document.getElementById('step-meta').textContent = String(e.message || e);
  }
}

boot();
