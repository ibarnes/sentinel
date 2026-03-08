import fs from 'fs/promises';
import path from 'path';
import { createSnapshot, listSnapshots, getSnapshot } from '../../services/snapshotService.js';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';

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

// mutate reviewed flow after snapshot
seed.reviewVersion = 2;
seed.steps.push({ id: 's2', index: 2, title: 'Step 2', action: 'submit', intent: null, target: { elementType: 'submit_action', text: 'B' }, page: { url: 'https://app.test/b' }, screenshots: {}, confidence: 0.7, annotations: [] });
await writeJson(reviewedPath, seed);

const b = await createSnapshot(flowId, { createdBy: 'fixture' });
if (b.error) throw new Error(b.error);

const list = await listSnapshots(flowId);
if ((list.snapshots || []).length < 2) throw new Error('expected 2 snapshots');

const first = await getSnapshot(flowId, a.snapshot.snapshotId);
if (first.error) throw new Error(first.error);
if ((first.snapshot.reviewedFlow.steps || []).length !== 1) throw new Error('snapshot immutability failed');

console.log(`OK snapshot fixtures: first=${a.snapshot.snapshotId} second=${b.snapshot.snapshotId} count=${list.snapshots.length}`);
