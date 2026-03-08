import {
  newId,
  fileForSession,
  fileForRawEvents,
  writeJson,
  readJson,
  appendJsonl,
  readJsonl
} from '../storage/revealStorage.js';

export async function createSession({ source = 'unknown', meta = {} } = {}) {
  const sessionId = newId('session');
  const session = {
    sessionId,
    source,
    meta,
    status: 'recording',
    startedAt: new Date().toISOString(),
    endedAt: null,
    rawEventCount: 0
  };
  await writeJson(fileForSession(sessionId), session);
  return session;
}

export async function appendEvents(sessionId, events = []) {
  if (!Array.isArray(events) || !events.length) return { accepted: 0 };
  const normalized = events.map((e) => ({
    id: e.id || newId('evt'),
    sessionId,
    ts: e.timestamp || new Date().toISOString(),
    type: e.actionType || e.type || 'unknown',
    url: e.pageUrl || e.url || '',
    selector: e.target?.selector || null,
    domPath: e.target?.domPath || null,
    text: e.target?.text || null,
    valueMasked: e.valueMasked || null,
    fileMeta: e.fileMeta || null,
    viewport: e.viewport || null,
    screenshotUrl: null,
    elementBox: e.target?.boundingBox || null,
    framePath: e.framePath || null,
    devicePixelRatio: Number(e.devicePixelRatio || 1),
    scrollX: Number(e.scrollX || 0),
    scrollY: Number(e.scrollY || 0),
    frameOrigin: e.frameOrigin || null,
    frameOffsetX: Number(e.frameOffsetX || 0),
    frameOffsetY: Number(e.frameOffsetY || 0),
    frameChain: Array.isArray(e.frameChain) ? e.frameChain : null,
    zoom: Number(e.zoom || 1),
    cssTransformScale: Number(e.cssTransformScale || 1),
    metadata: { raw: e }
  }));

  await appendJsonl(fileForRawEvents(sessionId), normalized);

  const sessionPath = fileForSession(sessionId);
  const session = await readJson(sessionPath, null);
  if (session) {
    session.rawEventCount = Number(session.rawEventCount || 0) + normalized.length;
    await writeJson(sessionPath, session);
  }

  return { accepted: normalized.length };
}

export async function closeSession(sessionId) {
  const sessionPath = fileForSession(sessionId);
  const session = await readJson(sessionPath, null);
  if (!session) return null;
  session.status = 'stopped';
  session.endedAt = new Date().toISOString();
  await writeJson(sessionPath, session);
  return session;
}

export async function getSessionEvents(sessionId) {
  return readJsonl(fileForRawEvents(sessionId));
}

export async function getSession(sessionId) {
  return readJson(fileForSession(sessionId), null);
}
