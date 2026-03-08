import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getShotList } from './shotListService.js';
import { listEditIntents, applyEditIntentsToShotList, diffShotLists } from './editIntentService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/shot-list-snapshots';

function dirFor(shotListId) { return path.join(ROOT, shotListId); }
function fileFor(shotListId, shotListSnapshotId) { return path.join(dirFor(shotListId), `${shotListSnapshotId}.json`); }
function id() { return `sls_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

export async function createShotListSnapshot(shotListId, { createdBy = null } = {}) {
  const got = await getShotList(shotListId);
  if (got.error) return got;
  const baseline = got.shotList;
  const intents = (await listEditIntents(shotListId)).editIntents || [];
  const effective = applyEditIntentsToShotList(baseline, intents);
  const diff = diffShotLists(baseline, effective);
  const shotListSnapshotId = id();

  const snapshot = {
    shotListSnapshotId,
    shotListId,
    sourceType: baseline.sourceType,
    sourceRef: baseline.sourceRef,
    shotListVersion: baseline.shotListVersion,
    createdAt: new Date().toISOString(),
    createdBy,
    sourceScriptId: baseline.sourceRef?.scriptId || null,
    sourceReviewedSnapshotId: baseline.metadata?.sourceApprovalTrust?.trustPublication?.latestReviewedSnapshotId || null,
    sourceTrustRefs: baseline.metadata?.sourceApprovalTrust || null,
    manifest: {
      shotListSnapshotId,
      shotListId,
      sceneCount: (effective.scenes || []).length,
      shotCount: (effective.scenes || []).reduce((n, s) => n + (s.shots || []).length, 0),
      changedShotCount: diff.changedShotCount,
      totalEstimatedDurationMs: effective.totalEstimatedDurationMs,
      createdAt: new Date().toISOString()
    },
    frozenShotList: effective,
    baselineSummary: { totalEstimatedDurationMs: baseline.totalEstimatedDurationMs, sceneCount: (baseline.scenes || []).length },
    editIntents: intents
  };

  await fs.mkdir(dirFor(shotListId), { recursive: true });
  const fp = fileFor(shotListId, shotListSnapshotId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'shot_list_snapshot_id_collision' };
  await fs.writeFile(fp, JSON.stringify(snapshot, null, 2), 'utf8');
  return { snapshot };
}

export async function listShotListSnapshots(shotListId) {
  const d = dirFor(shotListId);
  const exists = await fs.access(d).then(() => true).catch(() => false);
  if (!exists) return { snapshots: [] };
  const files = (await fs.readdir(d)).filter((f) => f.endsWith('.json'));
  const snapshots = [];
  for (const f of files) {
    try {
      const s = JSON.parse(await fs.readFile(path.join(d, f), 'utf8'));
      snapshots.push({ shotListSnapshotId: s.shotListSnapshotId, shotListId: s.shotListId, createdAt: s.createdAt, manifest: s.manifest });
    } catch {}
  }
  snapshots.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { snapshots };
}

export async function getShotListSnapshot(shotListId, shotListSnapshotId) {
  try {
    const snapshot = JSON.parse(await fs.readFile(fileFor(shotListId, shotListSnapshotId), 'utf8'));
    return { snapshot };
  } catch {
    return { error: 'shot_list_snapshot_not_found' };
  }
}
