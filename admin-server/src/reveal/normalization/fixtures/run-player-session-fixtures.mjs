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

// listing
const listed = await listPlayerSessions({ flowId, includeExpired: '1' });
if (!Array.isArray(listed.sessions) || listed.sessions.length < 1) throw new Error('listing failed');

// snapshot session + resume
const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
const ss = await createPlayerSession({ snapshotId: snap.snapshot.snapshotId });
if (ss.error) throw new Error(`snapshot session failed: ${ss.error}`);
const srs = await readSession(ss.session.sessionId);
srs.playbackStatus = 'expired';
await writeSessionFile(srs);
const resumed = await resumePlayerSession(ss.session.sessionId);
if (resumed.status !== 'resumed') throw new Error('snapshot resume failed');

// package session
const pkg = await buildReviewedPackage(flowId);
const buf = await fs.readFile(pkg.archivePath);
const sp = await createPlayerSession({ packageBuffer: buf, sourceRetentionPolicy: 'retained_package_copy' });
if (sp.error) throw new Error(`package session failed: ${sp.error}`);
if (sp.session.sourceType !== 'reveal_package') throw new Error('package sourceType invalid');

// force expired and sweep cleanup
const spRaw = await readSession(sp.session.sessionId);
spRaw.createdAt = '2000-01-01T00:00:00.000Z';
spRaw.playbackStatus = 'paused';
await writeSessionFile(spRaw);
const sw = await sweepPlayerSessions();
if (!sw.ok) throw new Error('sweeper failed');
const spAfter = await getPlayerSession(sp.session.sessionId);
if (spAfter.session.playbackStatus !== 'expired') throw new Error('sweeper did not expire session');

// package recovery rehydrate path
const spRes = await resumePlayerSession(sp.session.sessionId);
if (!['rehydrated_and_resumed','resumed'].includes(spRes.status || '')) {
  throw new Error(`unexpected package resume status: ${spRes.error || spRes.status}`);
}

// non-recoverable package policy
const sp2 = await createPlayerSession({ packageBuffer: buf, sourceRetentionPolicy: 'ephemeral_only' });
const sp2Raw = await readSession(sp2.session.sessionId);
sp2Raw.createdAt = '2000-01-01T00:00:00.000Z';
sp2Raw.playbackStatus = 'paused';
await writeSessionFile(sp2Raw);
await sweepPlayerSessions();
const sp2Res = await resumePlayerSession(sp2.session.sessionId);
if (sp2Res.error !== 'not_resumable') throw new Error('expected not_resumable for ephemeral policy');

// delete + cleanup metadata path
const del = await deletePlayerSession(sp.session.sessionId);
if (!del.deleted) throw new Error('delete session failed');
if (!['cleaned','none','failed'].includes(del.cleanupStatus)) throw new Error('cleanup status invalid');

const gone = await getPlayerSession(sp.session.sessionId);
if (gone.error !== 'session_not_found') throw new Error('deleted session still retrievable');

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK player session fixtures');
