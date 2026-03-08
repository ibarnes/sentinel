import fs from 'fs/promises';
import path from 'path';
import { loadFromFlow, loadFromSnapshot, loadFromPackage } from '../../player/flowPlayerService.js';
import { applyPlaybackControl } from '../../player/playbackController.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { buildReviewedPackage } from '../../services/packageService.js';
import { fileForReviewedFlow, writeJson } from '../../storage/revealStorage.js';

const flowId = 'fixture_player_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Player Fixture',
  reviewVersion: 1,
  steps: [
    { id: 'a', index: 1, title: 'Login', action: 'click', intent: 'Login', screenshots: { beforeUrl: null, afterUrl: null, highlightedUrl: null }, annotations: [], confidence: 0.8 },
    { id: 'b', index: 2, title: 'Open Dashboard', action: 'navigate', intent: null, screenshots: { beforeUrl: null, afterUrl: null, highlightedUrl: null }, annotations: [{ author: 'x', text: 'good' }], confidence: 0.7 }
  ]
});

const f = await loadFromFlow(flowId);
if (f.error) throw new Error('flow playback load failed');
if ((f.model.steps || []).length !== 2) throw new Error('flow playback step count invalid');

const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
if (snap.error) throw new Error(snap.error);
const s = await loadFromSnapshot(flowId, snap.snapshot.snapshotId);
if (s.error) throw new Error('snapshot playback load failed');

const pkg = await buildReviewedPackage(flowId);
if (pkg.error) throw new Error(pkg.error);
const p = await loadFromPackage(pkg.archivePath);
if (p.error) throw new Error('package playback load failed');
if (!p.model.packageToken) throw new Error('package token missing');

const c0 = applyPlaybackControl(2, 0, 'next', null);
if (c0.currentStepIndex !== 1) throw new Error('next control failed');
const c1 = applyPlaybackControl(2, 1, 'prev', null);
if (c1.currentStepIndex !== 0) throw new Error('prev control failed');
const c2 = applyPlaybackControl(2, 1, 'jump', 0);
if (c2.currentStepIndex !== 0) throw new Error('jump control failed');

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK player fixtures');
