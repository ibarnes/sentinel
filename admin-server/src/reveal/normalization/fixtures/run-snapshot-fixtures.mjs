import fs from 'fs/promises';
import path from 'path';
import {
  createSnapshot,
  listSnapshots,
  getSnapshot,
  verifySnapshotIntegrity,
  recomputeFlowSnapshotIntegrity
} from '../../services/snapshotService.js';
import { writeJson, fileForReviewedFlow, fileForSnapshot } from '../../storage/revealStorage.js';

const flowId = 'fixture_flow_snapshot';
const reviewedPath = fileForReviewedFlow(flowId);

const seed = {
  id: flowId,
  name: 'Fixture Flow Snapshot',
  description: 'snapshot fixture',
  appHost: 'app.test',
  version: 1,
  reviewVersion: 1,
  steps: [
    { id: 's1', index: 1, title: 'Step 1', action: 'click', intent: null, target: { elementType: 'button', text: 'A' }, page: { url: 'https://app.test' }, screenshots: {}, confidence: 0.8, annotations: [] }
  ]
};

await fs.mkdir(path.dirname(reviewedPath), { recursive: true });
await writeJson(reviewedPath, seed);

const a = await createSnapshot(flowId, { createdBy: 'fixture' });
if (a.error) throw new Error(a.error);
if (!a.snapshot.snapshotContentHash) throw new Error('missing snapshotContentHash on first snapshot');
if (a.snapshot.snapshotChainIndex !== 1) throw new Error('first snapshot should be chain index 1');

// mutate reviewed flow after snapshot
seed.reviewVersion = 2;
seed.steps.push({ id: 's2', index: 2, title: 'Step 2', action: 'submit', intent: null, target: { elementType: 'submit_action', text: 'B' }, page: { url: 'https://app.test/b' }, screenshots: {}, confidence: 0.7, annotations: [] });
await writeJson(reviewedPath, seed);

const b = await createSnapshot(flowId, { createdBy: 'fixture' });
if (b.error) throw new Error(b.error);
if (b.snapshot.snapshotChainIndex !== 2) throw new Error('second snapshot should be chain index 2');
if (b.snapshot.parentSnapshotId !== a.snapshot.snapshotId) throw new Error('parent linkage missing');
if (b.snapshot.parentSnapshotContentHash !== a.snapshot.snapshotContentHash) throw new Error('parent hash linkage missing');

const list = await listSnapshots(flowId);
if ((list.snapshots || []).length < 2) throw new Error('expected 2 snapshots');

const first = await getSnapshot(flowId, a.snapshot.snapshotId);
if (first.error) throw new Error(first.error);
if ((first.snapshot.reviewedFlow.steps || []).length !== 1) throw new Error('snapshot immutability failed');

// hash stability across rereads
const firstAgain = await getSnapshot(flowId, a.snapshot.snapshotId);
if (firstAgain.snapshot.snapshotContentHash !== first.snapshot.snapshotContentHash) throw new Error('hash instability across reread');

const i1 = await verifySnapshotIntegrity(flowId, a.snapshot.snapshotId);
if (i1.status !== 'match') throw new Error(`first snapshot integrity expected match got ${i1.status}`);

// tamper snapshot payload directly and ensure mismatch detected
const tamperedPath = fileForSnapshot(flowId, a.snapshot.snapshotId);
const tampered = await getSnapshot(flowId, a.snapshot.snapshotId);
 tampered.snapshot.reviewedFlow.name = 'tampered-name';
await writeJson(tamperedPath, tampered.snapshot);
const iTampered = await verifySnapshotIntegrity(flowId, a.snapshot.snapshotId);
if (iTampered.status !== 'mismatch') throw new Error('tampered snapshot not detected');

// break parent linkage on second snapshot
const secondPath = fileForSnapshot(flowId, b.snapshot.snapshotId);
const second = await getSnapshot(flowId, b.snapshot.snapshotId);
second.snapshot.parentSnapshotContentHash = 'broken-parent-hash';
await writeJson(secondPath, second.snapshot);
const iBroken = await verifySnapshotIntegrity(flowId, b.snapshot.snapshotId);
if (iBroken.status !== 'broken_parent_link') throw new Error('broken parent link not detected');

const flowIntegrity = await recomputeFlowSnapshotIntegrity(flowId);
if (flowIntegrity.totalSnapshots < 2) throw new Error('flow integrity snapshot count invalid');
if (flowIntegrity.brokenChainLinks < 1) throw new Error('flow integrity should detect broken chain');

console.log(`OK snapshot fixtures: first=${a.snapshot.snapshotId} second=${b.snapshot.snapshotId} total=${list.snapshots.length} integrityBroken=${flowIntegrity.brokenChainLinks}`);
