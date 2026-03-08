let state = {
  flowId: null,
  flow: null,
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
  try {
    await api(`/reveal/api/flows/${encodeURIComponent(flowId)}/review/init`, 'POST', {});
  } catch (e) {
    if (!String(e.message).includes('already')) throw e;
  }
}

async function loadPreferred(flowId) {
  const j = await api(`/reveal/api/flows/${encodeURIComponent(flowId)}`);
  return j.flow;
}

async function loadReview(flowId) {
  const j = await api(`/reveal/api/flows/${encodeURIComponent(flowId)}/review`);
  return j.flow;
}

function renderTimeline(flow) {
  const ul = document.getElementById('timeline-list');
  ul.innerHTML = '';

  (flow.steps || []).forEach((step, idx) => {
    const li = document.createElement('li');
    li.dataset.stepId = step.id;
    li.innerHTML = `<label><input type="checkbox" data-merge="${step.id}" /> ${idx + 1}. ${escapeHtml(step.title)}</label>`;
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

function showStep(step) {
  state.selectedStepId = step.id;
  document.getElementById('step-title').textContent = step.title || 'Step';
  document.getElementById('step-meta').textContent = `${step.action} • ${step.page?.url || ''}`;
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
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function refresh() {
  const flow = await loadReview(state.flowId);
  state.flow = flow;
  renderTimeline(flow);
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
}

async function boot() {
  const root = document.getElementById('reveal-editor');
  state.flowId = root?.dataset?.flowId;
  if (!state.flowId) return;
  try {
    await initReview(state.flowId);
    state.flow = await loadPreferred(state.flowId);
    renderTimeline(state.flow);
    wireActions();
  } catch (e) {
    document.getElementById('step-title').textContent = 'Unable to load flow';
    document.getElementById('step-meta').textContent = String(e.message || e);
  }
}

boot();
