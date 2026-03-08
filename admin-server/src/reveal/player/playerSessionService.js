import crypto from 'crypto';
import fs from 'fs/promises';
import { loadFromFlow, loadFromSnapshot } from './flowPlayerService.js';
import { createPackagePlaybackFromBuffer, cleanupPackageToken } from './packageSessionService.js';
import { applyPlaybackControl } from './playbackController.js';
import { writeSession, readSession, deleteSessionFile, listSessionFiles } from './sessionStorageService.js';
import { shouldExpire, computeExpiry, summarizeSession, isResumable } from './sessionLifecycleService.js';

function nowIso() { return new Date().toISOString(); }
function mkSessionId() { return `ps_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function activeStatus(s) { return ['ready', 'playing', 'paused'].includes(s.playbackStatus); }

function rewritePackageAssetUrls(model, sessionId) {
  for (const step of model.steps || []) {
    for (const k of ['screenshotBefore', 'screenshotAfter', 'highlight']) {
      const url = step[k];
      if (!url || !url.includes('/api/player/packages/')) continue;
      const m = url.match(/\/api\/player\/packages\/([^/]+)\/assets\/(screenshots|highlights)\/([^/]+\.jpg)$/);
      if (!m) continue;
      step[k] = `/reveal/api/player/sessions/${sessionId}/assets/${m[2]}/${m[3]}`;
    }
  }
}

async function expireSessionInternal(session) {
  session.playbackStatus = 'expired';
  session.updatedAt = nowIso();
  if (session.sourceType === 'reveal_package' && session.sourceRef?.packageRef?.token) {
    session.cleanupStatus = 'pending';
    session.cleanupStartedAt = nowIso();
    const cleaned = await cleanupPackageToken(session.sourceRef.packageRef.token);
    session.cleanupCompletedAt = nowIso();
    session.cleanupStatus = cleaned.status;
    if (!cleaned.ok) session.cleanupError = 'cleanup_failed';
  }
  await writeSession(session);
  return session;
}

async function readAndMaybeExpire(sessionId) {
  const session = await readSession(sessionId);
  if (!session) return null;
  if (shouldExpire(session)) return expireSessionInternal(session);
  return session;
}

function payload(session) {
  return {
    session,
    model: session.model,
    playback: applyPlaybackControl(session.stepCount, session.currentStepIndex)
  };
}

export async function createPlayerSession({ flowId = null, snapshotId = null, packageBuffer = null, viewerMetadata = null } = {}) {
  const provided = [!!flowId, !!snapshotId, !!packageBuffer].filter(Boolean).length;
  if (provided === 0) return { error: 'missing_source_input' };
  if (provided > 1) return { error: 'conflicting_source_inputs' };

  const sessionId = mkSessionId();
  let loaded;
  let sourceType;
  const sourceRef = { flowId: null, snapshotId: null, packageRef: null };

  if (flowId) {
    loaded = await loadFromFlow(flowId);
    sourceType = 'reviewed_flow';
    sourceRef.flowId = flowId;
  } else if (snapshotId) {
    loaded = await loadFromSnapshot(null, snapshotId);
    sourceType = 'immutable_snapshot';
    sourceRef.flowId = loaded?.model?.flowId || null;
    sourceRef.snapshotId = snapshotId;
  } else {
    loaded = await createPackagePlaybackFromBuffer(packageBuffer);
    sourceType = 'reveal_package';
    sourceRef.flowId = loaded?.model?.flowId || null;
    sourceRef.packageRef = { token: loaded?.model?.packageToken || null };
  }

  if (loaded?.error) return loaded;

  const model = loaded.model;
  if (!Array.isArray(model.steps) || model.steps.length === 0) return { error: 'malformed_playback_model' };

  const now = nowIso();
  const session = {
    sessionId,
    sourceType,
    sourceRef,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    expiresAt: null,
    currentStepIndex: 0,
    autoPlayEnabled: false,
    playbackStatus: 'ready',
    stepCount: model.steps.length,
    viewerMetadata: viewerMetadata || null,
    cleanupStatus: sourceType === 'reveal_package' ? 'pending' : 'none',
    model
  };

  if (sourceType === 'reveal_package') {
    rewritePackageAssetUrls(session.model, sessionId);
    session.cleanupStatus = 'none';
  }

  session.expiresAt = computeExpiry(session);
  await writeSession(session);
  return payload(session);
}

export async function getPlayerSession(sessionId) {
  const session = await readAndMaybeExpire(sessionId);
  if (!session) return { error: 'session_not_found' };
  return payload(session);
}

export async function listPlayerSessions(filters = {}) {
  const validStatus = new Set(['ready','playing','paused','completed','expired']);
  const validSource = new Set(['reviewed_flow','immutable_snapshot','reveal_package']);
  if (filters.status && !validStatus.has(filters.status)) return { error: 'invalid_status_filter' };
  if (filters.sourceType && !validSource.has(filters.sourceType)) return { error: 'invalid_source_type_filter' };

  const ids = await listSessionFiles();
  const includeExpired = String(filters.includeExpired || '0') === '1';
  const out = [];

  for (const id of ids) {
    const s = await readAndMaybeExpire(id);
    if (!s) continue;

    if (!includeExpired && s.playbackStatus === 'expired') continue;
    if (filters.status && s.playbackStatus !== filters.status) continue;
    if (filters.sourceType && s.sourceType !== filters.sourceType) continue;
    if (filters.flowId && s.sourceRef?.flowId !== filters.flowId) continue;
    if (filters.snapshotId && s.sourceRef?.snapshotId !== filters.snapshotId) continue;

    out.push(summarizeSession(s));
  }

  return { sessions: out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) };
}

export async function patchPlayerSession(sessionId, { action = null, jumpTo = null, autoPlayEnabled = null } = {}) {
  const session = await readAndMaybeExpire(sessionId);
  if (!session) return { error: 'session_not_found' };
  if (session.playbackStatus === 'expired') return { error: 'session_expired' };

  if (autoPlayEnabled !== null) session.autoPlayEnabled = Boolean(autoPlayEnabled);

  if (action) {
    if (action === 'play') {
      if (session.playbackStatus === 'completed') return { error: 'invalid_transition_completed_to_playing' };
      if (!['ready', 'paused', 'playing'].includes(session.playbackStatus)) return { error: 'invalid_transition' };
      session.playbackStatus = 'playing';
    } else if (action === 'pause') {
      if (session.playbackStatus !== 'playing') return { error: 'invalid_transition' };
      session.playbackStatus = 'paused';
    } else if (['next', 'prev', 'restart', 'jump'].includes(action)) {
      if (!activeStatus(session)) return { error: 'invalid_transition' };
      if (action === 'jump') {
        const idx = Number(jumpTo);
        if (!Number.isFinite(idx) || idx < 0 || idx >= session.stepCount) return { error: 'jump_out_of_range' };
      }
      const pb = applyPlaybackControl(session.stepCount, session.currentStepIndex, action, jumpTo);
      session.currentStepIndex = pb.currentStepIndex;
      if (session.currentStepIndex >= session.stepCount - 1 && action === 'next' && session.autoPlayEnabled) {
        session.playbackStatus = 'completed';
      }
    } else if (action === 'setAutoPlay') {
      // no-op, uses autoPlayEnabled patch above
    } else {
      return { error: 'unsupported_action' };
    }
  }

  session.updatedAt = nowIso();
  session.lastActivityAt = session.updatedAt;
  session.expiresAt = computeExpiry(session);
  await writeSession(session);
  return payload(session);
}

export async function resumePlayerSession(sessionId) {
  let session = await readSession(sessionId);
  if (!session) return { error: 'session_not_found' };

  if (session.playbackStatus !== 'expired') {
    return { status: 'already_active', ...payload(session) };
  }

  if (!isResumable(session)) {
    return { error: 'not_resumable', reason: session.sourceType === 'reveal_package' ? 'expired_assets_cleaned' : 'missing_source' };
  }

  if (session.sourceType === 'reviewed_flow') {
    const loaded = await loadFromFlow(session.sourceRef?.flowId);
    if (loaded.error) return { error: 'missing_source' };
    session.model = loaded.model;
  } else if (session.sourceType === 'immutable_snapshot') {
    const loaded = await loadFromSnapshot(session.sourceRef?.flowId || null, session.sourceRef?.snapshotId);
    if (loaded.error) return { error: 'missing_source' };
    session.model = loaded.model;
  } else if (session.sourceType === 'reveal_package') {
    if (session.cleanupStatus === 'cleaned') return { error: 'not_resumable', reason: 'expired_assets_cleaned' };
  }

  session.playbackStatus = 'paused';
  session.updatedAt = nowIso();
  session.lastActivityAt = session.updatedAt;
  session.expiresAt = computeExpiry(session);
  await writeSession(session);
  return { status: 'resumed', ...payload(session) };
}

export async function deletePlayerSession(sessionId) {
  const session = await readSession(sessionId);
  if (!session) return { error: 'session_not_found' };

  session.playbackStatus = 'expired';
  session.updatedAt = nowIso();
  if (session.sourceType === 'reveal_package' && session.sourceRef?.packageRef?.token) {
    session.cleanupStatus = 'pending';
    session.cleanupStartedAt = nowIso();
    const cleaned = await cleanupPackageToken(session.sourceRef.packageRef.token);
    session.cleanupCompletedAt = nowIso();
    session.cleanupStatus = cleaned.status;
    if (!cleaned.ok) session.cleanupError = 'cleanup_failed';
  }
  await writeSession(session);
  await deleteSessionFile(sessionId);
  return { deleted: true, cleanupStatus: session.cleanupStatus };
}

export async function resolveSessionAssetPath(sessionId, kind, file) {
  const session = await readSession(sessionId);
  if (!session) return { error: 'session_not_found' };
  if (session.sourceType !== 'reveal_package') return { error: 'asset_not_supported_for_source' };
  const token = session.sourceRef?.packageRef?.token;
  if (!token) return { error: 'missing_package_ref' };

  const stem = String(file || '').replace(/\.(jpg|jpeg|png)$/i, '');
  const m = stem.match(/^(.*)-(before|after|highlight)$/);
  if (!m) return { error: 'invalid_asset_name' };
  const stepId = m[1];
  const expectedKind = m[2] === 'highlight' ? 'highlights' : 'screenshots';
  if (kind !== expectedKind) return { error: 'asset_kind_mismatch' };

  const base = kind === 'highlights' ? 'assets/highlights' : 'assets/screenshots';
  const p = `/home/ec2-user/.openclaw/workspace/reveal/storage/player-packages/${token}/${base}/${stepId}-${m[2]}.jpg`;
  return { path: p };
}
