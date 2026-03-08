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
  selectedForMerge: new Set(),
  latestScript: null,
  latestShotList: null,
  latestVoiceTrack: null,
  latestUnified: null,
  latestExternal: null
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

function selectedStyleProfile() {
  return document.getElementById('script-style')?.value || 'neutral_walkthrough';
}

function renderScriptPreview(script) {
  const pre = document.getElementById('script-preview');
  if (!pre) return;
  if (!script) {
    pre.textContent = 'No script generated.';
    return;
  }
  pre.textContent = JSON.stringify({
    scriptId: script.scriptId,
    sourceType: script.sourceType,
    styleProfile: script.styleProfile,
    totalEstimatedDurationMs: script.totalEstimatedDurationMs,
    sections: script.sections.map((s) => ({
      stepIndex: s.stepIndex,
      title: s.title,
      narrationText: s.narrationText,
      onScreenText: s.onScreenText,
      timing: s.timing
    }))
  }, null, 2);
}

async function createScript(payload) {
  const out = await api('/reveal/api/scripts', 'POST', {
    ...payload,
    styleProfile: selectedStyleProfile(),
    createdBy: 'editor-user'
  });
  state.latestScript = out.script;
  renderScriptPreview(out.script);
}

async function createScriptFromFlow() {
  await createScript({ flowId: state.flowId });
}

async function createScriptFromSnapshot() {
  const sid = selectedSnapshotId();
  if (!sid) return alert('Select snapshot first');
  await createScript({ snapshotId: sid });
}

async function createScriptFromSession() {
  const sessionId = prompt('Enter sessionId');
  if (!sessionId) return;
  await createScript({ sessionId });
}

function exportLatestScript(format) {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  download(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/export?format=${encodeURIComponent(format)}`);
}

async function initScriptReview() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/init`, 'POST', { actor: 'editor-user' });
  renderScriptPreview({ ...state.latestScript, review: out.reviewed, diff: out.diff });
}

async function editReviewedSection() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const sid = prompt('Section ID to edit');
  if (!sid) return;
  const narrationText = prompt('New narration text');
  if (narrationText == null) return;
  const onScreenText = prompt('New on-screen text (optional)', '');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/sections/${encodeURIComponent(sid)}`, 'PATCH', { narrationText, onScreenText, actor: 'editor-user' });
  renderScriptPreview({ ...state.latestScript, review: out.reviewed, diff: out.diff });
}

async function addReviewedNote() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const sid = prompt('Section ID for note');
  if (!sid) return;
  const note = prompt('Note text');
  if (!note) return;
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/sections/${encodeURIComponent(sid)}/notes`, 'POST', { note, actor: 'editor-user' });
  renderScriptPreview({ ...state.latestScript, review: out.reviewed, diff: out.diff });
}

async function viewScriptDiff() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/diff`);
  const pre = document.getElementById('script-preview');
  pre.textContent = JSON.stringify(out, null, 2);
}

async function updateScriptReviewStatus() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const targetStatus = prompt('targetStatus: draft|in_review|approved|rejected|published_ready', 'in_review');
  if (!targetStatus) return;
  const reason = targetStatus === 'rejected' ? (prompt('Rejection reason', 'Needs revision') || null) : null;
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/status`, 'POST', { targetStatus, reason, actor: 'editor-user' });
  renderScriptPreview({ ...state.latestScript, review: out.reviewed, diff: out.diff });
}

function exportReviewedScript(format) {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  download(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/export?format=${encodeURIComponent(format)}`);
}

function renderShotListPreview(shotList) {
  const pre = document.getElementById('script-preview');
  if (!pre) return;
  pre.textContent = JSON.stringify({
    shotListId: shotList.shotListId,
    sourceType: shotList.sourceType,
    totalEstimatedDurationMs: shotList.totalEstimatedDurationMs,
    sceneCount: shotList.scenes?.length || 0,
    scenes: (shotList.scenes || []).map((s) => ({
      sceneId: s.sceneId,
      title: s.title,
      estimatedDurationMs: s.estimatedDurationMs,
      timeline: s.timeline,
      shots: (s.shots || []).map((h) => ({ shotId: h.shotId, shotType: h.shotType, title: h.title, startOffsetMs: h.startOffsetMs, endOffsetMs: h.endOffsetMs }))
    }))
  }, null, 2);
}

async function createShotList(payload) {
  const out = await api('/reveal/api/production/shot-lists', 'POST', payload);
  state.latestShotList = out.shotList;
  renderShotListPreview(out.shotList);
}

async function createShotListFromScript() {
  if (!state.latestScript?.scriptId) return alert('Generate script first');
  await createShotList({ scriptId: state.latestScript.scriptId, publishReady: '1' });
}

async function createShotListFromFlow() {
  await createShotList({ flowId: state.flowId });
}

async function createShotListFromSession() {
  const sessionId = prompt('Session ID');
  if (!sessionId) return;
  await createShotList({ sessionId });
}

function exportShotList(format) {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  download(`/reveal/api/production/shot-lists/${encodeURIComponent(state.latestShotList.shotListId)}/export?format=${encodeURIComponent(format)}`);
}

async function addShotEditIntent() {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  const shotId = prompt('shotId');
  if (!shotId) return;
  const type = prompt('type: hold_extension_ms|trim_start_ms|trim_end_ms|reorder_hint|transition_override|emphasis_override|note|disable_shot|duplicate_for_variant', 'note');
  if (!type) return;
  const valueRaw = prompt('value', '1000');
  const value = ['hold_extension_ms','trim_start_ms','trim_end_ms','reorder_hint'].includes(type) ? Number(valueRaw) : valueRaw;
  await api(`/reveal/api/production/shot-lists/${encodeURIComponent(state.latestShotList.shotListId)}/edit-intents`, 'POST', { shotId, type, value, createdBy: 'editor-user' });
  alert('Edit intent added');
}

async function viewShotListWithDiff() {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  const out = await api(`/reveal/api/production/shot-lists/${encodeURIComponent(state.latestShotList.shotListId)}?view=with_diff`);
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

async function createShotListSnapshotUi() {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  const out = await api(`/reveal/api/production/shot-lists/${encodeURIComponent(state.latestShotList.shotListId)}/snapshots`, 'POST', { createdBy: 'editor-user' });
  alert(`Shot list snapshot created: ${out.snapshot.shotListSnapshotId}`);
}

async function listShotListSnapshotsUi() {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  const out = await api(`/reveal/api/production/shot-lists/${encodeURIComponent(state.latestShotList.shotListId)}/snapshots`);
  const lines = (out.snapshots || []).map((s) => `${s.shotListSnapshotId} • scenes ${s.manifest?.sceneCount} • shots ${s.manifest?.shotCount}`);
  alert(lines.length ? lines.join('\n') : 'No shot list snapshots');
}

function exportAssemblyPackageUi() {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  download(`/reveal/api/production/shot-lists/${encodeURIComponent(state.latestShotList.shotListId)}/export?format=assembly_package`);
}

async function createVoicePlan(payload) {
  const out = await api('/reveal/api/production/voice-tracks', 'POST', payload);
  state.latestVoiceTrack = out.voiceTrackPlan;
  document.getElementById('script-preview').textContent = JSON.stringify({
    voiceTrackPlanId: out.voiceTrackPlan.voiceTrackPlanId,
    sourceType: out.voiceTrackPlan.sourceType,
    totalEstimatedDurationMs: out.voiceTrackPlan.totalEstimatedDurationMs,
    segments: out.voiceTrackPlan.segments.map((s) => ({ segmentId: s.segmentId, startOffsetMs: s.startOffsetMs, endOffsetMs: s.endOffsetMs, narrationText: s.narrationText })),
    captions: out.voiceTrackPlan.captions.slice(0, 8)
  }, null, 2);
}

async function createVoicePlanFromScript() {
  if (!state.latestScript?.scriptId) return alert('Generate script first');
  await createVoicePlan({ scriptId: state.latestScript.scriptId, publishReady: '1' });
}

async function createVoicePlanFromShotList() {
  if (!state.latestShotList?.shotListId) return alert('Generate shot list first');
  await createVoicePlan({ shotListId: state.latestShotList.shotListId });
}

function exportVoicePlan(format) {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  download(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/export?format=${encodeURIComponent(format)}`);
}

async function createVoicePlanSnapshotUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/snapshots`, 'POST', { createdBy: 'editor-user' });
  alert(`Voice plan snapshot created: ${out.snapshot.voicePlanSnapshotId}`);
}

async function listVoicePlanSnapshotsUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/snapshots`);
  const lines = (out.snapshots || []).map((s) => `${s.voicePlanSnapshotId} • idx ${s.voicePlanSnapshotChainIndex} • hash ${String(s.voicePlanSnapshotContentHash || '').slice(0,12)}…`);
  alert(lines.length ? lines.join('\n') : 'No voice snapshots');
}

async function recomputeVoiceIntegrityUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/snapshots/integrity/recompute`, 'POST', {});
  alert(`Voice integrity: total=${out.totalSnapshots}, match=${out.matched}, mismatch=${out.mismatched}, broken=${out.brokenChainLinks}`);
}

function exportSubtitleBundleUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  download(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/export?format=subtitle_bundle`);
}

async function viewVoiceAuditReportUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/audit-report`);
  document.getElementById('script-preview').textContent = JSON.stringify(out.report, null, 2);
}

async function publishVoiceTrustUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/trust-publications`, 'POST', {});
  alert(`Voice trust publication: ${out.voiceTrustPublication.voiceTrustPublicationId}`);
}

async function viewLatestVoiceTrustUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/trust-publications/latest`);
  document.getElementById('script-preview').textContent = JSON.stringify(out.voiceTrustPublication, null, 2);
}

async function verifyLatestVoiceUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const out = await api(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/verify-latest`);
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

function exportSignedSubtitleBundleUi() {
  if (!state.latestVoiceTrack?.voiceTrackPlanId) return alert('Generate voice plan first');
  const profile = prompt('orchestration profile: dev|internal_verified|production_verified', 'internal_verified') || 'internal_verified';
  download(`/reveal/api/production/voice-tracks/${encodeURIComponent(state.latestVoiceTrack.voiceTrackPlanId)}/export?format=signed_subtitle_bundle&orchestrationPolicyProfile=${encodeURIComponent(profile)}`);
}

async function verifyBundleJsonUi() {
  const raw = prompt('Paste signed subtitle bundle JSON');
  if (!raw) return;
  let bundle;
  try { bundle = JSON.parse(raw); } catch { return alert('Invalid JSON'); }
  const out = await api('/reveal/api/production/voice-tracks/verify-bundle', 'POST', { bundle });
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

async function generateUnifiedVerifierUi() {
  const payload = {
    scriptId: state.latestScript?.scriptId || null,
    shotListId: state.latestShotList?.shotListId || null,
    voiceTrackPlanId: state.latestVoiceTrack?.voiceTrackPlanId || null,
    orchestrationPolicyProfile: prompt('Policy profile: dev|internal_verified|production_verified', 'internal_verified') || 'internal_verified'
  };
  const out = await api('/reveal/api/verification/unified', 'POST', payload);
  state.latestUnified = out.verifierPackage;
  document.getElementById('script-preview').textContent = JSON.stringify(out.verifierPackage, null, 2);
}

function exportUnifiedAttestationUi() {
  if (!state.latestUnified?.verifierPackageId) return alert('Generate unified verifier first');
  download(`/reveal/api/verification/unified/${encodeURIComponent(state.latestUnified.verifierPackageId)}/export?format=attestation_bundle`);
}

async function listPoliciesUi() {
  const out = await api('/reveal/api/verification/policies');
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

async function createAttestationSnapshotUi() {
  if (!state.latestUnified?.verifierPackageId) return alert('Generate unified verifier first');
  const out = await api(`/reveal/api/verification/unified/${encodeURIComponent(state.latestUnified.verifierPackageId)}/attestation-snapshots`, 'POST', { createdBy: 'editor-user' });
  alert(`Attestation snapshot: ${out.snapshot.attestationSnapshotId}`);
}

async function listAttestationSnapshotsUi() {
  if (!state.latestUnified?.verifierPackageId) return alert('Generate unified verifier first');
  const out = await api(`/reveal/api/verification/unified/${encodeURIComponent(state.latestUnified.verifierPackageId)}/attestation-snapshots`);
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

async function publishAttestationTrustUi() {
  if (!state.latestUnified?.verifierPackageId) return alert('Generate unified verifier first');
  const out = await api(`/reveal/api/verification/unified/${encodeURIComponent(state.latestUnified.verifierPackageId)}/attestation-trust-publications`, 'POST', {});
  alert(`Attestation trust publication: ${out.attestationTrustPublication.attestationTrustPublicationId}`);
}

async function viewLatestAttestationTrustUi() {
  if (!state.latestUnified?.verifierPackageId) return alert('Generate unified verifier first');
  const out = await api(`/reveal/api/verification/unified/${encodeURIComponent(state.latestUnified.verifierPackageId)}/attestation-trust-publications/latest`);
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

async function verifyZipBundleUi() {
  const raw = prompt('Paste ZIP bundle as base64 string (for quick verify)');
  if (!raw) return;
  const out = await api('/reveal/api/verification/verify-zip-bundle', 'POST', { bundle: raw });
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

async function generateExternalVerifierUi() {
  const payload = {
    verifierPackageId: state.latestUnified?.verifierPackageId || null,
    policyProfileId: prompt('Policy profile: dev|internal_verified|production_verified', 'production_verified') || 'production_verified',
    mode: 'latest'
  };
  const out = await api('/reveal/api/verification/external', 'POST', payload);
  state.latestExternal = out.externalVerifierProfile;
  document.getElementById('script-preview').textContent = JSON.stringify(out.externalVerifierProfile, null, 2);
}

async function viewExternalLatestUi() {
  const profile = prompt('Policy profile', 'production_verified') || 'production_verified';
  const out = await api(`/reveal/api/verification/external/latest?policyProfileId=${encodeURIComponent(profile)}&mode=latest`);
  state.latestExternal = out.externalVerifierProfile;
  document.getElementById('script-preview').textContent = JSON.stringify(out.externalVerifierProfile, null, 2);
}

function exportExternalVerdictUi() {
  if (!state.latestExternal?.externalVerifierProfileId) return alert('Generate external verifier first');
  download(`/reveal/api/verification/external/${encodeURIComponent(state.latestExternal.externalVerifierProfileId)}/export?format=compliance_verdict`);
}

function exportPublishReadyReviewedMarkdown() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  download(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/export?format=markdown&mode=publish_ready`);
}

async function createReviewedSnapshot() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/snapshots`, 'POST', { actor: 'editor-user' });
  alert(`Reviewed snapshot created: ${out.snapshot.reviewedSnapshotId}`);
}

async function listReviewedSnapshots() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/snapshots`);
  const lines = (out.snapshots || []).map((s) => `${s.reviewedSnapshotId} • idx ${s.reviewedSnapshotChainIndex} • hash ${String(s.reviewedSnapshotContentHash || '').slice(0,12)}… • parent ${s.parentReviewedSnapshotId || 'root'}`);
  alert(lines.length ? lines.join('\n') : 'No reviewed snapshots yet');
}

async function recomputeSnapshotIntegrity() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/snapshots/integrity/recompute`, 'POST', {});
  alert(`Integrity recompute: total=${out.totalSnapshots}, match=${out.matched}, mismatch=${out.mismatched}, brokenChain=${out.brokenChainLinks}, missingHash=${out.missingHash}`);
}

async function publishTrustHead() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/trust-publications`, 'POST', {});
  alert(`Trust publication created: ${out.trustPublication.trustPublicationId}\nheadDigest=${out.trustPublication.chainHeadDigest}`);
}

async function viewLatestTrustPublication() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/trust-publications/latest`);
  document.getElementById('script-preview').textContent = JSON.stringify(out.trustPublication, null, 2);
}

async function verifyLatestExternal() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/verify-latest`);
  document.getElementById('script-preview').textContent = JSON.stringify(out, null, 2);
}

function exportProofBundle(format) {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  download(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/export-with-proof?format=${encodeURIComponent(format)}`);
}

async function viewAuditReport() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/audit-report`);
  const pre = document.getElementById('script-preview');
  pre.textContent = JSON.stringify(out.report, null, 2);
}

async function checkPublishGate() {
  if (!state.latestScript?.scriptId) return alert('Generate a script first');
  const out = await api(`/reveal/api/scripts/${encodeURIComponent(state.latestScript.scriptId)}/review/audit-report?requireLatestReviewedSnapshotIntegrity=1`);
  const gate = out.report?.publishGate;
  if (!gate) return alert('No gate result');
  alert(`canPublish=${gate.canPublish}\nblocking=${(gate.blockingReasons||[]).join(', ') || 'none'}\nwarnings=${(gate.warnings||[]).join(', ') || 'none'}\nlatestSnapshotHash=${out.report?.latestReviewedSnapshotHash || 'n/a'}\nlatestSnapshotIntegrity=${out.report?.latestReviewedSnapshotIntegrityStatus || 'n/a'}`);
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

  document.querySelector('[data-action="script-generate-flow"]')?.addEventListener('click', () => createScriptFromFlow().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-generate-snapshot"]')?.addEventListener('click', () => createScriptFromSnapshot().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-generate-session"]')?.addEventListener('click', () => createScriptFromSession().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-init"]')?.addEventListener('click', () => initScriptReview().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-edit-section"]')?.addEventListener('click', () => editReviewedSection().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-add-note"]')?.addEventListener('click', () => addReviewedNote().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-diff"]')?.addEventListener('click', () => viewScriptDiff().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-status"]')?.addEventListener('click', () => updateScriptReviewStatus().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-snapshot-create"]')?.addEventListener('click', () => createReviewedSnapshot().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-snapshot-list"]')?.addEventListener('click', () => listReviewedSnapshots().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-snapshot-integrity-recompute"]')?.addEventListener('click', () => recomputeSnapshotIntegrity().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-trust-publish"]')?.addEventListener('click', () => publishTrustHead().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-trust-latest"]')?.addEventListener('click', () => viewLatestTrustPublication().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-verify-latest"]')?.addEventListener('click', () => verifyLatestExternal().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-proof-export-json"]')?.addEventListener('click', () => exportProofBundle('json'));
  document.querySelector('[data-action="script-review-proof-export-zip"]')?.addEventListener('click', () => exportProofBundle('zip'));
  document.querySelector('[data-action="script-review-audit-report"]')?.addEventListener('click', () => viewAuditReport().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-gate"]')?.addEventListener('click', () => checkPublishGate().catch((e) => alert(e.message)));
  document.querySelector('[data-action="script-review-export-json"]')?.addEventListener('click', () => exportReviewedScript('json'));
  document.querySelector('[data-action="script-review-export-md"]')?.addEventListener('click', () => exportReviewedScript('markdown'));
  document.querySelector('[data-action="script-review-publish-export-md"]')?.addEventListener('click', () => exportPublishReadyReviewedMarkdown());
  document.querySelector('[data-action="script-export-json"]')?.addEventListener('click', () => exportLatestScript('json'));
  document.querySelector('[data-action="script-export-md"]')?.addEventListener('click', () => exportLatestScript('markdown'));

  document.querySelector('[data-action="shotlist-generate-script"]')?.addEventListener('click', () => createShotListFromScript().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-generate-flow"]')?.addEventListener('click', () => createShotListFromFlow().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-generate-session"]')?.addEventListener('click', () => createShotListFromSession().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-export-json"]')?.addEventListener('click', () => exportShotList('json'));
  document.querySelector('[data-action="shotlist-export-md"]')?.addEventListener('click', () => exportShotList('markdown'));
  document.querySelector('[data-action="shotlist-add-edit-intent"]')?.addEventListener('click', () => addShotEditIntent().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-view-with-diff"]')?.addEventListener('click', () => viewShotListWithDiff().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-snapshot-create"]')?.addEventListener('click', () => createShotListSnapshotUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-snapshot-list"]')?.addEventListener('click', () => listShotListSnapshotsUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="shotlist-export-assembly"]')?.addEventListener('click', () => exportAssemblyPackageUi());

  document.querySelector('[data-action="voiceplan-generate-script"]')?.addEventListener('click', () => createVoicePlanFromScript().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-generate-shotlist"]')?.addEventListener('click', () => createVoicePlanFromShotList().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-export-json"]')?.addEventListener('click', () => exportVoicePlan('json'));
  document.querySelector('[data-action="voiceplan-export-md"]')?.addEventListener('click', () => exportVoicePlan('markdown'));
  document.querySelector('[data-action="voiceplan-export-srt"]')?.addEventListener('click', () => exportVoicePlan('srt'));
  document.querySelector('[data-action="voiceplan-export-vtt"]')?.addEventListener('click', () => exportVoicePlan('vtt'));
  document.querySelector('[data-action="voiceplan-snapshot-create"]')?.addEventListener('click', () => createVoicePlanSnapshotUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-snapshot-list"]')?.addEventListener('click', () => listVoicePlanSnapshotsUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-integrity-recompute"]')?.addEventListener('click', () => recomputeVoiceIntegrityUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-export-bundle"]')?.addEventListener('click', () => exportSubtitleBundleUi());
  document.querySelector('[data-action="voiceplan-trust-publish"]')?.addEventListener('click', () => publishVoiceTrustUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-trust-latest"]')?.addEventListener('click', () => viewLatestVoiceTrustUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-verify-latest"]')?.addEventListener('click', () => verifyLatestVoiceUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-export-signed-bundle"]')?.addEventListener('click', () => exportSignedSubtitleBundleUi());
  document.querySelector('[data-action="voiceplan-verify-bundle"]')?.addEventListener('click', () => verifyBundleJsonUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="voiceplan-audit-report"]')?.addEventListener('click', () => viewVoiceAuditReportUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="unified-generate"]')?.addEventListener('click', () => generateUnifiedVerifierUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="unified-export-attestation"]')?.addEventListener('click', () => exportUnifiedAttestationUi());
  document.querySelector('[data-action="unified-attestation-snapshot-create"]')?.addEventListener('click', () => createAttestationSnapshotUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="unified-attestation-snapshot-list"]')?.addEventListener('click', () => listAttestationSnapshotsUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="unified-attestation-trust-publish"]')?.addEventListener('click', () => publishAttestationTrustUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="unified-attestation-trust-latest"]')?.addEventListener('click', () => viewLatestAttestationTrustUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="external-generate"]')?.addEventListener('click', () => generateExternalVerifierUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="external-latest"]')?.addEventListener('click', () => viewExternalLatestUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="external-export-verdict"]')?.addEventListener('click', () => exportExternalVerdictUi());
  document.querySelector('[data-action="unified-verify-zip"]')?.addEventListener('click', () => verifyZipBundleUi().catch((e) => alert(e.message)));
  document.querySelector('[data-action="policy-list"]')?.addEventListener('click', () => listPoliciesUi().catch((e) => alert(e.message)));
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
