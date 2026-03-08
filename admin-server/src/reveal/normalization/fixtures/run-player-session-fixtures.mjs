import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { buildReviewedPackage } from '../../services/packageService.js';
import { createPlayerSession, getPlayerSession, patchPlayerSession, deletePlayerSession, listPlayerSessions, resumePlayerSession } from '../../player/playerSessionService.js';
import { readSession, writeSession as writeSessionFile } from '../../player/sessionStorageService.js';
import { sweepPlayerSessions } from '../../player/playerSessionSweeper.js';

const flowId = 'fixture_player_session_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Player Session Fixture',
  reviewVersion: 1,
  steps: [
    { id: 's1', index: 1, title: 'A', action: 'click', screenshots: {}, annotations: [] },
    { id: 's2', index: 2, title: 'B', action: 'click', screenshots: {}, annotations: [] }
  ]
});

// flow session
const sf = await createPlayerSession({ flowId });
if (sf.error) throw new Error(`flow session create failed: ${sf.error}`);
const sid = sf.session.sessionId;

let g = await getPlayerSession(sid);
if (g.error) throw new Error('session get failed');
if (g.session.currentStepIndex !== 0) throw new Error('initial index invalid');

await patchPlayerSession(sid, { action: 'next' });
g = await getPlayerSession(sid);
if (g.session.currentStepIndex !== 1) throw new Error('next failed');

await patchPlayerSession(sid, { action: 'prev' });
g = await getPlayerSession(sid);
if (g.session.currentStepIndex !== 0) throw new Error('prev failed');

const badJump = await patchPlayerSession(sid, { action: 'jump', jumpTo: 99 });
if (badJump.error !== 'jump_out_of_range') throw new Error('invalid jump rejection failed');

await patchPlayerSession(sid, { action: 'play', autoPlayEnabled: true });
g = await getPlayerSession(sid);
if (!g.session.autoPlayEnabled || g.session.playbackStatus !== 'playing') throw new Error('play/autoplay update failed');
await patchPlayerSession(sid, { action: 'restart' });

// listing + filter
const listed = await listPlayerSessions({ flowId, includeExpired: '1' });
if (!Array.isArray(listed.sessions) || listed.sessions.length < 1) throw new Error('listing failed');
const listedRecoverable = await listPlayerSessions({ flowId, includeExpired: '1', recoverable: '1' });
if (!Array.isArray(listedRecoverable.sessions)) throw new Error('recoverable listing failed');

// snapshot session + resume
const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
const ss = await createPlayerSession({ snapshotId: snap.snapshot.snapshotId });
if (ss.error) throw new Error(`snapshot session failed: ${ss.error}`);
const srs = await readSession(ss.session.sessionId);
srs.playbackStatus = 'expired';
await writeSessionFile(srs);
const resumed = await resumePlayerSession(ss.session.sessionId);
if (!['resumed','already_active'].includes(resumed.status)) throw new Error('snapshot resume failed');

// package session ephemeral (non-recoverable after cleanup)
const pkg = await buildReviewedPackage(flowId);
const buf = await fs.readFile(pkg.archivePath);
const spEphemeral = await createPlayerSession({ packageBuffer: buf, sourceRetentionPolicy: 'ephemeral_only' });
if (spEphemeral.error) throw new Error(`package session failed: ${spEphemeral.error}`);
const epRaw = await readSession(spEphemeral.session.sessionId);
epRaw.createdAt = '2000-01-01T00:00:00.000Z';
epRaw.playbackStatus = 'paused';
await writeSessionFile(epRaw);
await sweepPlayerSessions();
const epResume = await resumePlayerSession(spEphemeral.session.sessionId);
if (epResume.error !== 'not_resumable') throw new Error('expected non-resumable ephemeral package session');

// package session retained (rehydrate path)
const spRetained = await createPlayerSession({ packageBuffer: buf, sourceRetentionPolicy: 'retained_package_copy' });
if (spRetained.error) throw new Error(`retained package session failed: ${spRetained.error}`);
const rpRaw = await readSession(spRetained.session.sessionId);
rpRaw.createdAt = '2000-01-01T00:00:00.000Z';
rpRaw.playbackStatus = 'paused';
await writeSessionFile(rpRaw);
await sweepPlayerSessions();
const rpRes = await resumePlayerSession(spRetained.session.sessionId);
if (!['rehydrated_and_resumed','resumed'].includes(rpRes.status)) throw new Error('expected retained package rehydrate resume');

// cleanup failure handling path (best-effort check)
const del = await deletePlayerSession(spRetained.session.sessionId);
if (!del.deleted) throw new Error('delete session failed');
if (!['cleaned','none','failed'].includes(del.cleanupStatus)) throw new Error('cleanup status invalid');

const gone = await getPlayerSession(spRetained.session.sessionId);
if (gone.error !== 'session_not_found') throw new Error('deleted session still retrievable');

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK player session fixtures');
