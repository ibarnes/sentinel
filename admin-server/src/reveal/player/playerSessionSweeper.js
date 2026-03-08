import { listSessionFiles, readSession, writeSession } from './sessionStorageService.js';
import { shouldExpire, summarizeSession } from './sessionLifecycleService.js';
import { cleanupPackageToken } from './packageSessionService.js';

let inProgress = false;
let intervalHandle = null;

export async function sweepPlayerSessions() {
  if (inProgress) return { ok: true, skipped: true, reason: 'already_running' };
  inProgress = true;
  const startedAt = new Date().toISOString();

  const results = [];
  try {
    const ids = await listSessionFiles();
    for (const id of ids) {
      try {
        const s = await readSession(id);
        if (!s) continue;
        if (!shouldExpire(s)) continue;

        s.playbackStatus = 'expired';
        s.updatedAt = new Date().toISOString();

        if (s.sourceType === 'reveal_package' && s.sourceRef?.packageRef?.token) {
          s.cleanupStatus = 'pending';
          s.cleanupStartedAt = new Date().toISOString();
          const c = await cleanupPackageToken(s.sourceRef.packageRef.token);
          s.cleanupCompletedAt = new Date().toISOString();
          s.cleanupStatus = c.status;
          if (!c.ok) s.cleanupError = 'cleanup_failed';
        }

        await writeSession(s);
        results.push({ sessionId: s.sessionId, status: 'expired', cleanupStatus: s.cleanupStatus || 'none' });
      } catch (e) {
        results.push({ sessionId: id, status: 'error', error: String(e.message || e) });
      }
    }

    return {
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      expiredCount: results.filter((r) => r.status === 'expired').length,
      errorCount: results.filter((r) => r.status === 'error').length,
      results
    };
  } finally {
    inProgress = false;
  }
}

export function startPlayerSessionSweeper() {
  if (intervalHandle) return intervalHandle;
  const ms = Number(process.env.REVEAL_PLAYER_SWEEP_INTERVAL_MS || 5 * 60 * 1000);
  intervalHandle = setInterval(() => {
    sweepPlayerSessions().catch(() => {});
  }, ms);
  return intervalHandle;
}
