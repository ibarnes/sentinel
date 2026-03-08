let state = {
  flowId: null,
  flow: null,
  baseline: null,
  reviewed: null,
  compare: null,
  snapshots: [],
  packageTrust: null,
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
    const driftWarn = Boolean(step.metadata?.highlightDriftWarning);
    const integrityStatus = step.metadata?.replayIntegrityStatus || 'n/a';

    li.innerHTML = `<label><input type="checkbox" data-merge="${step.id}" /> ${idx + 1}. ${escapeHtml(step.title)}</label>
      <div class="step-trust">
        ${diffBadge}
        ${badge(`conf ${(step.confidence ?? 0).toFixed(2)}`, 'info')}
        ${badge(step.target?.elementType || 'unknown', 'neutral')}
        ${badge(`shots ${shotCount}/3`, shotCount >= 2 ? 'ok' : 'warn')}
        ${badge(`hl ${hiMode}`, hiMode === 'rendered' ? 'ok' : 'warn')}
        ${driftWarn ? badge('drift>20%', 'warn') : ''}
        ${badge(`integrity ${integrityStatus}`, integrityStatus === 'match' ? 'ok' : (integrityStatus === 'mismatch' ? 'warn' : 'neutral'))}
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
  const warnings = state.compare?.diff?.warnings || [];
  if (warnings.length) {
    const li = document.createElement('li');
    li.innerHTML = `<strong>Compare warnings:</strong> ${warnings.length}`;
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

function renderDiagnostics(step, baselineSteps = []) {
  const panel = document.getElementById('compare-panel');
  if (!panel) return;
  const p = step.screenshots?.provenance || {};
  const d = step.screenshots?.diagnostics || {};
  const fc = p.frameContext || {};

  let diagHtml = `<div class="cmp-col"><h4>Diagnostics (Reviewed)</h4>
    <div>coordinateConfidence: ${Number(step.coordinateConfidence ?? 0).toFixed(2)}</div>
    <div>reasonCodes: ${(step.coordinateConfidenceReasonCodes || []).join(', ') || 'none'}</div>
    <div>frameChain: ${escapeHtml(fc.frameChainSummary || fc.framePath || 'n/a')}</div>
    <div>viewport: src ${d.sourceViewport?.width || '-'}x${d.sourceViewport?.height || '-'} → norm ${d.normalizedViewport?.width || '-'}x${d.normalizedViewport?.height || '-'}</div>
    <div>renderedImage: ${d.renderedImageDimensions?.width || '-'}x${d.renderedImageDimensions?.height || '-'}</div>
    <div>driftWarning: ${step.metadata?.highlightDriftWarning ? 'yes' : 'no'} (${step.metadata?.highlightDriftRatio ?? 'n/a'})</div>
    <div>highlightMode: ${step.metadata?.highlightMode || 'fallback'} (${step.metadata?.highlightFallbackReason || 'ok'})</div>
  </div>`;

  if (baselineSteps.length) {
    const b = baselineSteps[0];
    const bp = b.screenshots?.provenance || {};
    const bd = b.screenshots?.diagnostics || {};
    const bfc = bp.frameContext || {};
    diagHtml += `<div class="cmp-col"><h4>Diagnostics (Baseline)</h4>
      <div>coordinateConfidence: ${Number(b.coordinateConfidence ?? 0).toFixed(2)}</div>
      <div>reasonCodes: ${(b.coordinateConfidenceReasonCodes || []).join(', ') || 'none'}</div>
      <div>frameChain: ${escapeHtml(bfc.frameChainSummary || bfc.framePath || 'n/a')}</div>
      <div>viewport: src ${bd.sourceViewport?.width || '-'}x${bd.sourceViewport?.height || '-'} → norm ${bd.normalizedViewport?.width || '-'}x${bd.normalizedViewport?.height || '-'}</div>
      <div>renderedImage: ${bd.renderedImageDimensions?.width || '-'}x${bd.renderedImageDimensions?.height || '-'}</div>
      <div>highlightMode: ${b.metadata?.highlightMode || 'fallback'} (${b.metadata?.highlightFallbackReason || 'ok'})</div>
    </div>`;
  }

  return diagHtml;
}

async function loadReplay(stepId) {
  try {
    return await api(`/reveal/api/flows/${state.flowId}/steps/${stepId}/coordinate-replay`);
  } catch (e) {
    return { error: String(e.message || e), warnings: ['replay_fetch_failed'] };
  }
}

async function loadIntegrity(stepId) {
  try {
    return await api(`/reveal/api/flows/${state.flowId}/steps/${stepId}/replay-integrity?includeDiff=1`);
  } catch (e) {
    return { status: 'unavailable', reasonCodes: ['integrity_fetch_failed'], error: String(e.message || e) };
  }
}

async function refreshSnapshots() {
  const out = await api(`/reveal/api/flows/${state.flowId}/snapshots`);
  state.snapshots = out.snapshots || [];
  try {
    const keyset = await api('/reveal/api/verification/keyset');
    state.packageTrust = {
      ...(await api(`/reveal/api/flows/${state.flowId}/export/verification-metadata`)),
      keyset
    };
  } catch {
    state.packageTrust = { verificationResult: { status: 'unsigned' }, verificationMetadata: { unsignedReason: 'missing_key' }, keyset: { keysetVersion: 'n/a', keysetSignatureStatus: 'unsigned' } };
  }
  const sel = document.getElementById('snapshot-select');
  if (!sel) return;
  sel.innerHTML = '';
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '-- select snapshot --';
  sel.appendChild(empty);
  for (const s of state.snapshots) {
    const o = document.createElement('option');
    o.value = s.snapshotId;
    o.textContent = `${s.snapshotId} (v${s.reviewVersion})`;
    sel.appendChild(o);
  }
  await renderSnapshotSummary();
}

function selectedSnapshotId() {
  return document.getElementById('snapshot-select')?.value || '';
}

async function renderSnapshotSummary() {
  const id = selectedSnapshotId();
  const s = state.snapshots.find((x) => x.snapshotId === id);
  const pre = document.getElementById('snapshot-summary');
  if (!pre) return;
  if (!s) {
    pre.textContent = 'No snapshot selected';
    return;
  }
  let integrity = null;
  let pkgVerify = null;
  try {
    integrity = await api(`/reveal/api/flows/${state.flowId}/snapshots/${encodeURIComponent(id)}/integrity`);
  } catch {
    integrity = { status: 'unavailable' };
  }
  try {
    pkgVerify = await api(`/reveal/api/flows/${state.flowId}/snapshots/${encodeURIComponent(id)}/export/verification-metadata`);
  } catch {
    pkgVerify = { verificationResult: { status: 'unavailable' } };
  }
  pre.textContent = JSON.stringify({
    reviewedPackageSigning: {
      status: state.packageTrust?.verificationResult?.status || 'unknown',
      keyId: state.packageTrust?.verificationMetadata?.signingKeyId || null,
      fingerprint: state.packageTrust?.verificationMetadata?.signerKeyFingerprint || null,
      trustProfile: state.packageTrust?.verificationMetadata?.trustProfileName || null,
      packageContentHash: state.packageTrust?.verificationMetadata?.packageContentHash || null,
      keysetVersion: state.packageTrust?.keyset?.keysetVersion || null,
      keysetSignatureStatus: state.packageTrust?.keyset?.keysetSignatureStatus || null
    },
    snapshotId: s.snapshotId,
    chainIndex: s.snapshotChainIndex,
    chainRoot: s.chainRoot,
    contentHash: s.snapshotContentHash,
    parentSnapshotId: s.parentSnapshotId,
    parentSnapshotContentHash: s.parentSnapshotContentHash,
    manifest: s.manifest,
    integrity,
    snapshotPackageSigning: {
      status: pkgVerify?.verificationResult?.status || 'unknown',
      keyId: pkgVerify?.verificationMetadata?.signingKeyId || null,
      packageContentHash: pkgVerify?.verificationMetadata?.packageContentHash || null
    }
  }, null, 2);
}

function download(url) {
  window.open(url, '_blank', 'noopener');
}

async function createShareForFlow() {
  const accessMode = prompt('accessMode: internal|public_token', 'public_token') || 'public_token';
  const mode = prompt('embedMode: standard_embed|minimal_embed|kiosk_embed', 'minimal_embed') || 'minimal_embed';
  const out = await api('/reveal/api/player/share-links', 'POST', {
    targetType: 'flow',
    targetRef: state.flowId,
    accessMode,
    embed: { embedMode: mode },
    playbackDefaults: { autoSession: true }
  });
  const url = `${location.origin}/reveal/share/${out.share.shareId}`;
  const embedUrl = `${location.origin}/reveal/share/${out.share.shareId}/embed`;
  const iframe = `<iframe src="${embedUrl}" width="960" height="600" style="border:0" allowfullscreen loading="lazy"></iframe>`;
  navigator.clipboard?.writeText(url).catch(() => {});
  alert(`Share URL (copied): ${url}\nEmbed URL: ${embedUrl}\n\n${iframe}`);
}

async function createShareForSnapshot() {
  const sid = selectedSnapshotId();
  if (!sid) return alert('Select snapshot first');
  const out = await api('/reveal/api/player/share-links', 'POST', {
    targetType: 'snapshot',
    targetRef: sid,
    accessMode: 'public_token',
    embed: { embedMode: 'minimal_embed' },
    playbackDefaults: { autoSession: true }
  });
  const url = `${location.origin}/reveal/share/${out.share.shareId}`;
  navigator.clipboard?.writeText(url).catch(() => {});
  alert(`Snapshot share URL (copied): ${url}`);
}

async function listSharesForFlow() {
  const out = await api(`/reveal/api/player/share-links?targetType=flow&targetRef=${encodeURIComponent(state.flowId)}`);
  const lines = (out.shares || []).slice(0, 15).map((s) => `${s.shareId} • ${s.status} • ${s.embed?.embedMode || 'standard_embed'} • ${s.expiresAt || 'no-expiry'}`);
  alert(lines.length ? lines.join('\n') : 'No shares');
}

function renderInspector(step, replay, integrity) {
  const el = document.getElementById('coord-inspector');
  if (!el) return;
  const sb = replay?.sourceBox || step?.target?.elementBox || null;
  const nb = replay?.finalBoxes?.normalizedBox || step?.metadata?.normalizedHighlightBox || null;
  const rb = replay?.finalBoxes?.renderedBox || null;
  const fd = integrity?.firstDivergence;
  const mismatch = integrity?.status === 'mismatch';
  const semSummary = integrity?.diffSummary?.semanticReasons || {};
  el.innerHTML = `<div class="cmp">
    <div class="cmp-col"><h4>Source Box</h4><div>${sb ? `x:${sb.x}, y:${sb.y}, w:${sb.width}, h:${sb.height}` : 'n/a'}</div></div>
    <div class="cmp-col"><h4>Normalized Box</h4><div>${nb ? `x:${nb.x}, y:${nb.y}, w:${nb.width}, h:${nb.height}` : 'n/a'}</div></div>
    <div class="cmp-col"><h4>Rendered Box</h4><div>${rb ? `x:${rb.x}, y:${rb.y}, w:${rb.width}, h:${rb.height}` : 'n/a'}</div></div>
    <div class="cmp-col"><h4>Integrity</h4><div>status: ${integrity?.status || 'n/a'}</div><div>checksum: ${integrity?.replayChecksum || 'n/a'}</div><div>version: ${integrity?.replayChecksumVersion || 'n/a'}</div>${mismatch && fd ? `<div>semantic: <strong>${escapeHtml(fd.semanticReason || 'unclassified_change')}</strong></div><div>sub-reason: <strong>${escapeHtml(fd.semanticSubReason || 'null')}</strong></div><div>first divergence: ${escapeHtml(fd.path || 'n/a')} (${escapeHtml(fd.reason || 'value_changed')})</div><div>stored: ${escapeHtml(JSON.stringify(fd.storedValue))}</div><div>current: ${escapeHtml(JSON.stringify(fd.currentValue))}</div><div>semantic summary: ${escapeHtml(JSON.stringify(semSummary))}</div><div>sub-reason summary: ${escapeHtml(JSON.stringify(integrity?.diffSummary?.semanticSubReasons || {}))}</div>` : ''}</div>
  </div>`;
}

async function showStep(step) {
  state.selectedStepId = step.id;
  const shotCount = [step.screenshots?.beforeUrl, step.screenshots?.afterUrl, step.screenshots?.highlightedUrl].filter(Boolean).length;
  const p = step.screenshots?.provenance || {};
  const frameCtx = p.frameContext || {};
  document.getElementById('step-title').textContent = step.title || 'Step';
  document.getElementById('step-meta').textContent = `${step.action} • ${step.page?.url || ''} • confidence ${Number(step.confidence ?? 0).toFixed(2)} • type ${step.target?.elementType || 'unknown'} • screenshots ${shotCount}/3 • raw events ${(step.events || []).length} • highlight ${step.metadata?.highlightMode || 'fallback'} • DPR ${p.devicePixelRatio ?? '-'} • viewport ${p.viewportWidth || '-'}x${p.viewportHeight || '-'} • scroll ${p.scrollX || 0},${p.scrollY || 0} • frame ${frameCtx.framePath || 'top'}@${frameCtx.frameOffsetX || 0},${frameCtx.frameOffsetY || 0} • normalized ${p.highlightNormalizationApplied ? 'yes' : 'no'}`;

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
  const replay = await loadReplay(step.id);
  const integrity = await loadIntegrity(step.id);
  renderInspector(step, replay, integrity);
  const dbg = document.getElementById('debugger-panel');
  if (dbg) {
    dbg.textContent = JSON.stringify({ integrity, replay }, null, 2);
  }
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
    panel.innerHTML = `<div class="cmp"><div class="cmp-col"><strong>Compare:</strong> no baseline step match (${escapeHtml(d.state)})</div>${renderDiagnostics(step, []) || ''}</div>`;
    return;
  }

  const changed = (d.changedFields || []).join(', ') || 'none';
  const baselineBlock = base.map((b) => `<div class="cmp-col"><h4>Baseline</h4><div>title: ${escapeHtml(b.title || '')}</div><div>action: ${escapeHtml(b.action || '')}</div><div>intent: ${escapeHtml(b.intent || '')}</div><div>index: ${b.index}</div></div>`).join('');
  panel.innerHTML = `<div class="cmp"><div class="cmp-col"><h4>Reviewed</h4><div>title: ${escapeHtml(step.title || '')}</div><div>action: ${escapeHtml(step.action || '')}</div><div>intent: ${escapeHtml(step.intent || '')}</div><div>index: ${step.index}</div><div>diff: ${escapeHtml(d.state)} (${escapeHtml(changed)})</div></div>${baselineBlock}${renderDiagnostics(step, base) || ''}</div>`;
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
  await refreshSnapshots();
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
  document.querySelector('[data-action="integrity-recompute"]')?.addEventListener('click', async () => {
    const out = await api(`/reveal/api/flows/${state.flowId}/replay-integrity/recompute?includeDiff=1`, 'POST', {});
    alert(`Integrity recompute: matched ${out.summary.matchedSteps}/${out.summary.totalReplayableSteps}, mismatched ${out.summary.mismatchedSteps}, unreplayable ${out.summary.unreplayableSteps}`);
    await refresh();
  });
  document.querySelector('[data-action="snapshot-create"]')?.addEventListener('click', async () => {
    const createdBy = prompt('Snapshot createdBy', 'editor-user') || 'editor-user';
    await api(`/reveal/api/flows/${state.flowId}/snapshots`, 'POST', { createdBy });
    await refreshSnapshots();
  });
  document.querySelector('[data-action="snapshot-refresh"]')?.addEventListener('click', refreshSnapshots);
  document.querySelector('[data-action="snapshot-integrity-recompute"]')?.addEventListener('click', async () => {
    const out = await api(`/reveal/api/flows/${state.flowId}/snapshots/integrity/recompute`, 'POST', {});
    alert(`Snapshot integrity: matched ${out.matched}/${out.totalSnapshots}, mismatched ${out.mismatched}, broken ${out.brokenChainLinks}`);
    await refreshSnapshots();
  });
  document.getElementById('snapshot-select')?.addEventListener('change', () => { renderSnapshotSummary().catch(() => {}); });

  document.querySelector('[data-action="export-reviewed-json"]')?.addEventListener('click', () => download(`/reveal/api/flows/${state.flowId}/export?format=json`));
  document.querySelector('[data-action="export-reviewed-md"]')?.addEventListener('click', () => download(`/reveal/api/flows/${state.flowId}/export?format=markdown`));
  document.querySelector('[data-action="export-reviewed-package"]')?.addEventListener('click', () => download(`/reveal/api/flows/${state.flowId}/export?format=package`));
  document.querySelector('[data-action="share-create-flow"]')?.addEventListener('click', createShareForFlow);
  document.querySelector('[data-action="share-list-flow"]')?.addEventListener('click', listSharesForFlow);
  document.querySelector('[data-action="export-snapshot-json"]')?.addEventListener('click', () => {
    const sid = selectedSnapshotId();
    if (!sid) return alert('Select snapshot first');
    download(`/reveal/api/flows/${state.flowId}/snapshots/${encodeURIComponent(sid)}/export?format=json`);
  });
  document.querySelector('[data-action="export-snapshot-md"]')?.addEventListener('click', () => {
    const sid = selectedSnapshotId();
    if (!sid) return alert('Select snapshot first');
    download(`/reveal/api/flows/${state.flowId}/snapshots/${encodeURIComponent(sid)}/export?format=markdown`);
  });
  document.querySelector('[data-action="export-snapshot-package"]')?.addEventListener('click', () => {
    const sid = selectedSnapshotId();
    if (!sid) return alert('Select snapshot first');
    download(`/reveal/api/flows/${state.flowId}/snapshots/${encodeURIComponent(sid)}/export?format=package`);
  });
  document.querySelector('[data-action="share-create-snapshot"]')?.addEventListener('click', createShareForSnapshot);
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
