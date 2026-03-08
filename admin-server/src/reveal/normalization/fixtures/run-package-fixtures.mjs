import fs from 'fs/promises';
import { buildReviewedPackage, buildSnapshotPackage } from '../../services/packageService.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { fileForReviewedFlow, writeJson } from '../../storage/revealStorage.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const pexec = promisify(execFile);
const flowId = 'fixture_flow_package';

const reviewed = {
  id: flowId,
  name: 'Fixture Package Flow',
  appHost: 'app.test',
  reviewVersion: 1,
  steps: [
    { id: 'p1', index: 1, title: 'Step A', action: 'click', intent: null, target: { elementType: 'button', text: 'Open' }, page: { url: 'https://app.test' }, screenshots: { beforeUrl: '/reveal/storage/assets/missing/a/before.jpg' }, confidence: 0.8, annotations: [] }
  ]
};

await writeJson(fileForReviewedFlow(flowId), reviewed);
const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
if (snap.error) throw new Error(snap.error);

const rp = await buildReviewedPackage(flowId);
if (rp.error) throw new Error(rp.error);
const sp = await buildSnapshotPackage(flowId, snap.snapshot.snapshotId);
if (sp.error) throw new Error(sp.error);

async function listZip(z) {
  const { stdout } = await pexec('unzip', ['-Z1', z]);
  return stdout.split('\n').map((x) => x.trim()).filter(Boolean).sort();
}

const rList = await listZip(rp.archivePath);
const sList = await listZip(sp.archivePath);

for (const needed of ['manifest.json', 'reviewed-flow.json', 'reviewed-flow.md', 'integrity.json']) {
  if (!rList.includes(needed)) throw new Error(`reviewed package missing ${needed}`);
}
for (const needed of ['manifest.json', 'snapshot.json', 'snapshot.md', 'integrity.json']) {
  if (!sList.includes(needed)) throw new Error(`snapshot package missing ${needed}`);
}

// manifest omission handling check
const { stdout: manOut } = await pexec('unzip', ['-p', rp.archivePath, 'manifest.json']);
const man = JSON.parse(manOut);
if (!Array.isArray(man.omittedAssets)) throw new Error('manifest omittedAssets missing');

await fs.rm(rp.cleanupDir, { recursive: true, force: true });
await fs.rm(sp.cleanupDir, { recursive: true, force: true });

console.log(`OK package fixtures reviewed=${rList.length} snapshot=${sList.length}`);
