import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getReviewedScript } from './reviewedScriptService.js';
import { evaluatePublishGate } from './scriptPublishGateService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-script-snapshots';

function dirFor(scriptId) { return path.join(ROOT, scriptId); }
function fileFor(scriptId, reviewedSnapshotId) { return path.join(dirFor(scriptId), `${reviewedSnapshotId}.json`); }
function snapshotId() { return `rss_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function countNotes(reviewed) {
  return (reviewed.sections || []).reduce((n, s) => n + (s.annotations || []).length, 0);
}

function changedCount(diff) {
  return Number(diff?.changedSectionCount || 0);
}

function approvalSummary(reviewed) {
  return {
    reviewStatus: reviewed.reviewStatus,
    approvedAt: reviewed.approvalMetadata?.approvedAt || null,
    approvedBy: reviewed.approvalMetadata?.approvedBy || null,
    rejectedAt: reviewed.approvalMetadata?.rejectedAt || null,
    publishedReadyAt: reviewed.approvalMetadata?.publishedReadyAt || null
  };
}

export async function createReviewedSnapshot(scriptId, { actor = null } = {}) {
  const env = await getReviewedScript(scriptId);
  if (env.error) return env;
  const { baseline, reviewed, diff } = env;

  const reviewedSnapshotId = snapshotId();
  const gate = evaluatePublishGate({ baseline, reviewed });
  const now = new Date().toISOString();

  const snapshot = {
    reviewedSnapshotId,
    scriptId,
    reviewedScriptId: reviewed.reviewedScriptId,
    reviewVersion: reviewed.reviewVersion,
    createdAt: now,
    createdBy: actor || null,
    sourceGeneratedScriptVersion: baseline.scriptVersion,
    sourceReviewedReviewVersion: reviewed.reviewVersion,
    reviewStatusAtSnapshot: reviewed.reviewStatus,
    approvalMetadataAtSnapshot: reviewed.approvalMetadata || {},
    manifest: {
      reviewedSnapshotId,
      scriptId,
      reviewVersion: reviewed.reviewVersion,
      reviewStatus: reviewed.reviewStatus,
      sectionCount: (reviewed.sections || []).length,
      notesCount: countNotes(reviewed),
      changedSectionCount: changedCount(diff),
      approvalSummary: approvalSummary(reviewed),
      publishGateResult: gate,
      exportAvailability: {
        standardReviewedExport: true,
        publishReadyExport: gate.canPublish
      },
      createdAt: now
    },
    baselineSummary: {
      scriptId: baseline.scriptId,
      sourceType: baseline.sourceType,
      styleProfile: baseline.styleProfile,
      createdAt: baseline.createdAt,
      sectionCount: (baseline.sections || []).length
    },
    reviewed
  };

  await fs.mkdir(dirFor(scriptId), { recursive: true });
  const fp = fileFor(scriptId, reviewedSnapshotId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'snapshot_id_collision' };
  await fs.writeFile(fp, JSON.stringify(snapshot, null, 2), 'utf8');

  return { snapshot };
}

export async function listReviewedSnapshots(scriptId) {
  const dir = dirFor(scriptId);
  const exists = await fs.access(dir).then(() => true).catch(() => false);
  if (!exists) return { snapshots: [] };
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const snaps = [];
  for (const f of files) {
    try {
      const obj = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      snaps.push({
        reviewedSnapshotId: obj.reviewedSnapshotId,
        scriptId: obj.scriptId,
        reviewVersion: obj.reviewVersion,
        reviewStatusAtSnapshot: obj.reviewStatusAtSnapshot,
        createdAt: obj.createdAt,
        manifest: obj.manifest
      });
    } catch {}
  }
  snaps.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { snapshots: snaps };
}

export async function getReviewedSnapshot(scriptId, reviewedSnapshotId) {
  try {
    const snapshot = JSON.parse(await fs.readFile(fileFor(scriptId, reviewedSnapshotId), 'utf8'));
    return { snapshot };
  } catch {
    return { error: 'snapshot_not_found' };
  }
}
