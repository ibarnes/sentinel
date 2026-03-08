import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { buildReviewedPackage } from '../../services/packageService.js';
import { createPlayerSession, getPlayerSession, patchPlayerSession, deletePlayerSession } from '../../player/playerSessionService.js';

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

// snapshot session
const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
const ss = await createPlayerSession({ snapshotId: snap.snapshot.snapshotId });
if (ss.error) throw new Error(`snapshot session failed: ${ss.error}`);

// package session
const pkg = await buildReviewedPackage(flowId);
const buf = await fs.readFile(pkg.archivePath);
const sp = await createPlayerSession({ packageBuffer: buf });
if (sp.error) throw new Error(`package session failed: ${sp.error}`);
if (sp.session.sourceType !== 'reveal_package') throw new Error('package sourceType invalid');

// delete + cleanup metadata
const del = await deletePlayerSession(sp.session.sessionId);
if (!del.deleted) throw new Error('delete session failed');
if (!['cleaned','none','failed'].includes(del.cleanupStatus)) throw new Error('cleanup status invalid');

const gone = await getPlayerSession(sp.session.sessionId);
if (gone.error !== 'session_not_found') throw new Error('deleted session still retrievable');

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK player session fixtures');
