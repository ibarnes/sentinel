import { renderHighlightDataUrl } from './highlightRenderer.js';

const API_BASE = 'http://localhost:4180/reveal/api';

const state = {
  sessionId: null,
  recording: false,
  queue: [],
  flushTimer: null,
  maxBatch: 50
};

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return res.json();
}

async function startSession(meta = {}) {
  if (state.recording) return { sessionId: state.sessionId, alreadyRecording: true };
  const created = await api('/sessions', 'POST', { source: 'chrome-extension', meta });
  state.sessionId = created.sessionId;
  state.recording = true;
  scheduleFlush();
  return created;
}

async function stopSession() {
  if (!state.recording || !state.sessionId) return { stopped: false };
  await flushQueue();
  const out = await api(`/sessions/${state.sessionId}/stop`, 'POST', {});
  state.recording = false;
  state.sessionId = null;
  clearFlushTimer();
  return out;
}

function clearFlushTimer() {
  if (state.flushTimer) {
    clearInterval(state.flushTimer);
    state.flushTimer = null;
  }
}

function scheduleFlush() {
  if (state.flushTimer) return;
  state.flushTimer = setInterval(() => {
    flushQueue().catch(() => {});
  }, 2000);
}

async function captureScreenshot(tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(undefined, { format: 'jpeg', quality: 60 });
    return { dataUrl, tabId };
  } catch {
    return null;
  }
}

async function enqueueRawEvent(rawEvent, tabId) {
  if (!state.recording || !state.sessionId) return;
  const shouldCapture = Boolean(rawEvent?.significant);
  const shotBase = shouldCapture ? await captureScreenshot(tabId) : null;
  const shot = shotBase ? {
    ...shotBase,
    timestamp: rawEvent?.timestamp || new Date().toISOString(),
    devicePixelRatio: rawEvent?.devicePixelRatio || 1,
    viewport: rawEvent?.viewport || null,
    scrollX: rawEvent?.scrollX || 0,
    scrollY: rawEvent?.scrollY || 0,
    framePath: rawEvent?.framePath || 'top',
    frameOrigin: rawEvent?.frameOrigin || null,
    frameOffsetX: rawEvent?.frameOffsetX || 0,
    frameOffsetY: rawEvent?.frameOffsetY || 0,
    frameChain: rawEvent?.frameChain || null,
    zoom: rawEvent?.zoom || 1,
    cssTransformScale: rawEvent?.cssTransformScale || 1
  } : null;

  let highlight = null;
  if (shot?.dataUrl && rawEvent?.target?.boundingBox) {
    const rendered = await renderHighlightDataUrl({
      screenshotDataUrl: shot.dataUrl,
      elementBox: rawEvent.target.boundingBox,
      label: rawEvent.target.text || rawEvent.target.attributes?.['aria-label'] || 'Target'
    });
    if (rendered.ok) {
      highlight = { dataUrl: rendered.dataUrl, metadata: rendered.metadata };
    } else {
      highlight = { dataUrl: null, metadata: { mode: 'fallback', reason: rendered.reason || 'render_failed' } };
    }
  } else {
    highlight = { dataUrl: null, metadata: { mode: 'fallback', reason: 'missing_box_or_screenshot' } };
  }

  state.queue.push({ ...rawEvent, screenshot: shot, highlight, sessionId: state.sessionId });
  if (state.queue.length >= state.maxBatch) {
    await flushQueue();
  }
}

async function flushQueue() {
  if (!state.recording || !state.sessionId || state.queue.length === 0) return;
  const batch = state.queue.splice(0, state.maxBatch);
  await api(`/sessions/${state.sessionId}/events`, 'POST', { events: batch });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === 'reveal:start') {
      const result = await startSession({ from: 'action', url: sender.tab?.url || null });
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message?.type === 'reveal:stop') {
      const result = await stopSession();
      sendResponse({ ok: true, ...result });
      return;
    }

    if (message?.type === 'reveal:event') {
      await enqueueRawEvent(message.payload, sender.tab?.id);
      sendResponse({ ok: true, queued: true });
      return;
    }

    if (message?.type === 'reveal:status') {
      sendResponse({ ok: true, recording: state.recording, sessionId: state.sessionId, queued: state.queue.length });
      return;
    }

    sendResponse({ ok: false, error: 'unknown_message' });
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message });
  });
  return true;
});

chrome.action.onClicked.addListener(async () => {
  if (state.recording) {
    await stopSession();
  } else {
    await startSession({ from: 'toolbar-click' });
  }
});
