const TTL_MS = Number(process.env.REVEAL_PLAYER_SESSION_TTL_MS || 4 * 60 * 60 * 1000);
const IDLE_MS = Number(process.env.REVEAL_PLAYER_SESSION_IDLE_MS || 20 * 60 * 1000);

function ts(v) {
  const n = Date.parse(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export function computeExpiry(session, now = Date.now()) {
  const created = ts(session.createdAt);
  return new Date(created + TTL_MS).toISOString();
}

export function shouldExpire(session, now = Date.now()) {
  if (session.playbackStatus === 'expired') return false;
  const created = ts(session.createdAt);
  if (!created) return true;

  const ttlExceeded = now - created > TTL_MS;
  if (!ttlExceeded) return false;

  if (session.playbackStatus === 'playing') {
    const lastActive = ts(session.lastActivityAt || session.updatedAt || session.createdAt);
    return now - lastActive > IDLE_MS;
  }

  return ['ready', 'paused', 'completed'].includes(session.playbackStatus);
}

export function isResumable(session) {
  if (session.playbackStatus !== 'expired') return true;
  if (session.sourceType === 'reviewed_flow') return true;
  if (session.sourceType === 'immutable_snapshot') return true;
  if (session.sourceType === 'reveal_package') {
    return session.cleanupStatus !== 'cleaned';
  }
  return false;
}

export function summarizeSession(session) {
  return {
    sessionId: session.sessionId,
    sourceType: session.sourceType,
    flowId: session.sourceRef?.flowId || null,
    snapshotId: session.sourceRef?.snapshotId || null,
    playbackStatus: session.playbackStatus,
    currentStepIndex: session.currentStepIndex,
    stepCount: session.stepCount,
    autoPlayEnabled: Boolean(session.autoPlayEnabled),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt || computeExpiry(session),
    cleanupStatus: session.cleanupStatus || 'none',
    resumable: isResumable(session)
  };
}

export const LifecycleConfig = { TTL_MS, IDLE_MS };
