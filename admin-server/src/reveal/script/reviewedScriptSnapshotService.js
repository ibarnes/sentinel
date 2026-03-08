import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getReviewedScript } from './reviewedScriptService.js';
import { evaluatePublishGate } from './scriptPublishGateService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/reviewed-script-snapshots';
const HASH_VERSION = 'sha256-v1';

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

/**
 * Canonicalization rules for reviewed snapshot hashing:
 * - stable object key ordering (sorted keys)
 * - undefined removed, null preserved
 * - arrays preserve original semantic order
 * - numeric normalization to 6 decimal precision
 */
function canonicalize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((v) => canonicalize(v));
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(6));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      const v = canonicalize(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return value;
}

function buildHashPayload(snapshot) {
  return canonicalize({
    reviewedSnapshotId: snapshot.reviewedSnapshotId,
    scriptId: snapshot.scriptId,
    reviewedScriptId: snapshot.reviewedScriptId,
    reviewVersion: snapshot.reviewVersion,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    sourceGeneratedScriptVersion: snapshot.sourceGeneratedScriptVersion,
    sourceReviewedReviewVersion: snapshot.sourceReviewedReviewVersion,
    reviewStatusAtSnapshot: snapshot.reviewStatusAtSnapshot,
    approvalMetadataAtSnapshot: snapshot.approvalMetadataAtSnapshot,
    parentReviewedSnapshotId: snapshot.parentReviewedSnapshotId,
    parentReviewedSnapshotContentHash: snapshot.parentReviewedSnapshotContentHash,
    reviewedSnapshotChainIndex: snapshot.reviewedSnapshotChainIndex,
    baselineSummary: snapshot.baselineSummary,
    reviewed: snapshot.reviewed
  });
}

function computeSnapshotHash(snapshot) {
  const payload = buildHashPayload(snapshot);
  const canonical = JSON.stringify(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

async function listSnapshotFiles(scriptId) {
  const dir = dirFor(scriptId);
  const exists = await fs.access(dir).then(() => true).catch(() => false);
  if (!exists) return [];
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'));
  const snaps = [];
  for (const f of files) {
    try {
      const obj = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'));
      snaps.push(obj);
    } catch {}
  }
  snaps.sort((a, b) => Number(a.reviewedSnapshotChainIndex || 0) - Number(b.reviewedSnapshotChainIndex || 0));
  return snaps;
}

export async function createReviewedSnapshot(scriptId, { actor = null } = {}) {
  const env = await getReviewedScript(scriptId);
  if (env.error) return env;
  const { baseline, reviewed, diff } = env;

  const reviewedSnapshotId = snapshotId();
  const prior = await listSnapshotFiles(scriptId);
  const parent = prior.length ? prior[prior.length - 1] : null;

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
    parentReviewedSnapshotId: parent?.reviewedSnapshotId || null,
    parentReviewedSnapshotContentHash: parent?.reviewedSnapshotContentHash || null,
    reviewedSnapshotChainIndex: Number(parent?.reviewedSnapshotChainIndex || 0) + 1,
    reviewedSnapshotHashVersion: HASH_VERSION,
    baselineSummary: {
      scriptId: baseline.scriptId,
      sourceType: baseline.sourceType,
      styleProfile: baseline.styleProfile,
      createdAt: baseline.createdAt,
      sectionCount: (baseline.sections || []).length
    },
    reviewed
  };

  snapshot.reviewedSnapshotContentHash = computeSnapshotHash(snapshot);

  const gate = evaluatePublishGate({ baseline, reviewed });
  snapshot.manifest = {
    reviewedSnapshotId,
    scriptId,
    reviewVersion: reviewed.reviewVersion,
    reviewStatus: reviewed.reviewStatus,
    sectionCount: (reviewed.sections || []).length,
    notesCount: countNotes(reviewed),
    changedSectionCount: changedCount(diff),
    approvalSummary: approvalSummary(reviewed),
    reviewedSnapshotContentHash: snapshot.reviewedSnapshotContentHash,
    reviewedSnapshotHashVersion: snapshot.reviewedSnapshotHashVersion,
    parentReviewedSnapshotId: snapshot.parentReviewedSnapshotId,
    parentReviewedSnapshotContentHash: snapshot.parentReviewedSnapshotContentHash,
    reviewedSnapshotChainIndex: snapshot.reviewedSnapshotChainIndex,
    publishGateResult: gate,
    exportAvailability: {
      standardReviewedExport: true,
      publishReadyExport: gate.canPublish
    },
    createdAt: now
  };

  await fs.mkdir(dirFor(scriptId), { recursive: true });
  const fp = fileFor(scriptId, reviewedSnapshotId);
  const exists = await fs.access(fp).then(() => true).catch(() => false);
  if (exists) return { error: 'snapshot_id_collision' };
  await fs.writeFile(fp, JSON.stringify(snapshot, null, 2), 'utf8');

  return { snapshot };
}

export async function listReviewedSnapshots(scriptId) {
  const snapsRaw = await listSnapshotFiles(scriptId);
  const snaps = snapsRaw.map((obj) => ({
    reviewedSnapshotId: obj.reviewedSnapshotId,
    scriptId: obj.scriptId,
    reviewVersion: obj.reviewVersion,
    reviewStatusAtSnapshot: obj.reviewStatusAtSnapshot,
    createdAt: obj.createdAt,
    reviewedSnapshotContentHash: obj.reviewedSnapshotContentHash || null,
    reviewedSnapshotHashVersion: obj.reviewedSnapshotHashVersion || null,
    parentReviewedSnapshotId: obj.parentReviewedSnapshotId || null,
    parentReviewedSnapshotContentHash: obj.parentReviewedSnapshotContentHash || null,
    reviewedSnapshotChainIndex: obj.reviewedSnapshotChainIndex || null,
    isChainRoot: Number(obj.reviewedSnapshotChainIndex || 0) === 1,
    manifest: obj.manifest
  }));
  snaps.sort((a, b) => Number(a.reviewedSnapshotChainIndex || 0) - Number(b.reviewedSnapshotChainIndex || 0));
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

export async function findReviewedSnapshotById(reviewedSnapshotId) {
  try {
    const root = ROOT;
    const scripts = await fs.readdir(root);
    for (const scriptId of scripts) {
      const p = fileFor(scriptId, reviewedSnapshotId);
      try {
        const snapshot = JSON.parse(await fs.readFile(p, 'utf8'));
        return { snapshot };
      } catch {}
    }
    return { error: 'snapshot_not_found' };
  } catch {
    return { error: 'snapshot_not_found' };
  }
}

export async function verifyReviewedSnapshotIntegrity(scriptId, reviewedSnapshotId) {
  const got = await getReviewedSnapshot(scriptId, reviewedSnapshotId);
  if (got.error) return got;
  const snapshot = got.snapshot;

  const reasonCodes = [];
  const stored = snapshot.reviewedSnapshotContentHash || null;
  if (!stored) reasonCodes.push('missing_hash');

  const recomputed = computeSnapshotHash(snapshot);
  let integrityStatus = stored ? (stored === recomputed ? 'match' : 'mismatch') : 'missing_hash';

  if (snapshot.reviewedSnapshotChainIndex > 1) {
    if (!snapshot.parentReviewedSnapshotId || !snapshot.parentReviewedSnapshotContentHash) {
      integrityStatus = 'broken_parent_link';
      reasonCodes.push('missing_parent_link');
    } else {
      const parent = await getReviewedSnapshot(scriptId, snapshot.parentReviewedSnapshotId);
      if (parent.error || !parent.snapshot) {
        integrityStatus = 'broken_parent_link';
        reasonCodes.push('missing_parent_snapshot');
      } else if ((parent.snapshot.reviewedSnapshotContentHash || null) !== snapshot.parentReviewedSnapshotContentHash) {
        integrityStatus = 'broken_parent_link';
        reasonCodes.push('parent_hash_mismatch');
      }
    }
  }

  if (!reasonCodes.length && integrityStatus === 'match') reasonCodes.push('hash_match');
  if (!reasonCodes.length && integrityStatus === 'mismatch') reasonCodes.push('hash_mismatch');

  return {
    scriptId,
    reviewedSnapshotId,
    reviewedSnapshotChainIndex: snapshot.reviewedSnapshotChainIndex,
    storedContentHash: stored,
    recomputedContentHash: recomputed,
    hashVersion: snapshot.reviewedSnapshotHashVersion || null,
    integrityStatus,
    reasonCodes
  };
}

export async function recomputeReviewedSnapshotIntegrity(scriptId) {
  const list = await listReviewedSnapshots(scriptId);
  const rows = [];

  for (const s of list.snapshots || []) {
    const one = await verifyReviewedSnapshotIntegrity(scriptId, s.reviewedSnapshotId);
    rows.push(one);
  }

  const summary = {
    totalSnapshots: rows.length,
    matched: rows.filter((r) => r.integrityStatus === 'match').length,
    mismatched: rows.filter((r) => r.integrityStatus === 'mismatch').length,
    brokenChainLinks: rows.filter((r) => r.integrityStatus === 'broken_parent_link').length,
    missingHash: rows.filter((r) => r.integrityStatus === 'missing_hash').length,
    firstBrokenSnapshotId: (rows.find((r) => r.integrityStatus !== 'match') || {}).reviewedSnapshotId || null
  };

  return { ...summary, rows };
}
