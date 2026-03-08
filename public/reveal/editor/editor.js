async function loadFlow(flowId) {
  const r = await fetch(`/reveal/api/flows/${encodeURIComponent(flowId)}`);
  if (!r.ok) throw new Error('Flow not found');
  return r.json();
}

function renderTimeline(flow) {
  const ul = document.getElementById('timeline-list');
  ul.innerHTML = '';
  (flow.steps || []).forEach((step, idx) => {
    const li = document.createElement('li');
    li.textContent = `${idx + 1}. ${step.title}`;
    li.addEventListener('click', () => showStep(step));
    ul.appendChild(li);
  });
  if (flow.steps?.length) showStep(flow.steps[0]);
}

function showStep(step) {
  document.getElementById('step-title').textContent = step.title || 'Step';
  document.getElementById('step-meta').textContent = `${step.action} • ${step.page?.url || ''}`;
  document.getElementById('shot-before').src = step.screenshots?.beforeUrl || '';
  document.getElementById('shot-after').src = step.screenshots?.afterUrl || '';
  document.getElementById('shot-highlight').src = step.screenshots?.highlightedUrl || '';
}

async function boot() {
  const root = document.getElementById('reveal-editor');
  const flowId = root?.dataset?.flowId;
  if (!flowId) return;
  try {
    const { flow } = await loadFlow(flowId);
    renderTimeline(flow);
  } catch (e) {
    document.getElementById('step-title').textContent = 'Unable to load flow';
    document.getElementById('step-meta').textContent = String(e.message || e);
  }
}

boot();
