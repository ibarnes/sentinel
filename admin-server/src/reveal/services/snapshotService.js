import fs from 'fs/promises';
import crypto from 'crypto';
import {
  fileForReviewedFlow,
  fileForNormalizedFlow,
  dirForSnapshots,
  fileForSnapshot,
  readJson,
  writeJson
} from '../storage/revealStorage.js';

export const SNAPSHOT_HASH_VERSION = 'sha256-v1';

function canonicalize(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Number(value.toFixed(6)) : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => canonicalize(v)).filter((v) => v !== undefined);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) {
      if (['exportAvailability'].includes(k)) continue; // transient presentation field
      const v = canonicalize(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return undefined;
}

function snapshotCanonicalPayload(snapshot) {
  return canonicalize({
    snapshotId: snapshot.snapshotId,
    flowId: snapshot.flowId,
    reviewVersion: snapshot.reviewVersion,
    snapshotVersion: snapshot.snapshotVersion,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    sourceReviewedFlowVersion: snapshot.sourceReviewedFlowVersion,
    sourceNormalizedFlowVersion: snapshot.sourceNormalizedFlowVersion,
    sourceReplayChecksumSummary: snapshot.sourceReplayChecksumSummary,
    status: snapshot.status,
    parentSnapshotId: snapshot.parentSnapshotId,
    parentSnapshotContentHash: snapshot.parentSnapshotContentHash,
    snapshotChainIndex: snapshot.snapshotChainIndex,
    reviewedFlow: snapshot.reviewedFlow
  });
}

function computeSnapshotHash(snapshot) {
  const payload = snapshotCanonicalPayload(snapshot);
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return { hash, payload };
}

function countAnnotations(steps = []) {
  return steps.reduce((n, s) => n + ((s.annotations || []).length), 0);
}

function screenshotCoverage(steps = []) {
  const total = steps.length || 0;
  const withBefore = steps.filter((s) => s.screenshots?.beforeUrl).length;
  const withAfter = steps.filter((s) => s.screenshots?.afterUrl).length;
  const withHighlight = steps.filter((s) => s.screenshots?.highlightedUrl).length;
  return { total, withBefore, withAfter, withHighlight };
}

function replayIntegritySummary(steps = []) {
  return {
    matched: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'match').length,
    mismatched: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'mismatch').length,
    unreplayable: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'unreplayable_step').length,
    missing: steps.filter((s) => s.metadata?.replayIntegrityStatus === 'missing_baseline_checksum').length
  };
}

function mkSnapshotId(flowId, reviewVersion) {
  return `snap_${flowId}_${reviewVersion}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

async function readAllSnapshots(flowId) {
  const dir = dirForSnapshots(flowId);
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json')).sort();
    const items = [];
    for (const f of files) {
      const s = await readJson(`${dir}/${f}`, null);
      if (s) items.push(s);
    }
    return items.sort((a, b) => (a.snapshotChainIndex || 0) - (b.snapshotChainIndex || 0));
  } catch {
    return [];
  }
}

function buildManifest(snapshot) {
  const steps = snapshot.reviewedFlow?.steps || [];
  return {
    snapshotId: snapshot.snapshotId,
    flowId: snapshot.flowId,
    reviewVersion: snapshot.reviewVersion,
    stepCount: steps.length,
    annotationCount: countAnnotations(steps),
    screenshotCoverage: screenshotCoverage(steps),
    replayIntegritySummary: replayIntegritySummary(steps),
    snapshotContentHash: snapshot.snapshotContentHash,
    snapshotHashVersion: snapshot.snapshotHashVersion,
    parentSnapshotId: snapshot.parentSnapshotId,
    parentSnapshotContentHash: snapshot.parentSnapshotContentHash,
    snapshotChainIndex: snapshot.snapshotChainIndex,
    exportAvailability: ['json', 'markdown'],
    createdAt: snapshot.createdAt
  };
}

export async function createSnapshot(flowId, { createdBy = 'system' } = {}) {
  const reviewed = await readJson(fileForReviewedFlow(flowId), null);
  if (!reviewed) return { error: 'reviewed_flow_not_found' };

  const normalized = await readJson(fileForNormalizedFlow(flowId), null);
  const reviewVersion = Number(reviewed.reviewVersion || reviewed.version || 1);
  const snapshotId = mkSnapshotId(flowId, reviewVersion);
  const outPath = fileForSnapshot(flowId, snapshotId);
  const exists = await readJson(outPath, null);
  if (exists) return { error: 'snapshot_id_collision' };

  const prior = await readAllSnapshots(flowId);
  const parent = prior.length ? prior[prior.length - 1] : null;

  const snapshot = {
    snapshotId,
    flowId,
    reviewVersion,
    snapshotVersion: 1,
    createdAt: new Date().toISOString(),
    createdBy,
    sourceReviewedFlowVersion: reviewed.reviewVersion || reviewed.version || 1,
    sourceNormalizedFlowVersion: normalized?.version || 1,
    sourceReplayChecksumSummary: replayIntegritySummary(reviewed.steps || []),
    status: 'frozen',
    parentSnapshotId: parent?.snapshotId || null,
    parentSnapshotContentHash: parent?.snapshotContentHash || null,
    snapshotChainIndex: (parent?.snapshotChainIndex || 0) + 1,
    reviewedFlow: JSON.parse(JSON.stringify(reviewed))
  };

  const { hash, payload } = computeSnapshotHash(snapshot);
  snapshot.snapshotContentHash = hash;
  snapshot.snapshotHashVersion = SNAPSHOT_HASH_VERSION;
  snapshot.snapshotHashCanonicalPayload = payload;
  snapshot.manifest = buildManifest(snapshot);

  await fs.mkdir(dirForSnapshots(flowId), { recursive: true });
  await writeJson(outPath, snapshot);

  return { snapshot };
}

export async function listSnapshots(flowId) {
  const snapshots = await readAllSnapshots(flowId);
  return {
    snapshots: snapshots.map((s) => ({
      snapshotId: s.snapshotId,
      flowId: s.flowId,
      reviewVersion: s.reviewVersion,
      status: s.status,
      createdAt: s.createdAt,
      snapshotContentHash: s.snapshotContentHash,
      snapshotHashVersion: s.snapshotHashVersion,
      parentSnapshotId: s.parentSnapshotId,
      parentSnapshotContentHash: s.parentSnapshotContentHash,
      snapshotChainIndex: s.snapshotChainIndex,
      chainRoot: !s.parentSnapshotId,
      manifest: s.manifest
    }))
  };
}

export async function getSnapshot(flowId, snapshotId) {
  const s = await readJson(fileForSnapshot(flowId, snapshotId), null);
  return s ? { snapshot: s } : { error: 'snapshot_not_found' };
}

export async function verifySnapshotIntegrity(flowId, snapshotId) {
  const got = await getSnapshot(flowId, snapshotId);
  if (got.error) return got;
  const s = got.snapshot;

  if (!s.snapshotContentHash) return { flowId, snapshotId, status: 'missing_hash', reasonCodes: ['missing_snapshot_content_hash'] };
  if (s.snapshotHashVersion !== SNAPSHOT_HASH_VERSION) return { flowId, snapshotId, status: 'mismatch', reasonCodes: ['hash_version_mismatch'] };

  const { hash } = computeSnapshotHash({
    ...s,
    snapshotContentHash: undefined,
    snapshotHashVersion: undefined,
    snapshotHashCanonicalPayload: undefined,
    manifest: undefined
  });

  let status = s.snapshotContentHash === hash ? 'match' : 'mismatch';
  const reasonCodes = [];
  if (status === 'mismatch') reasonCodes.push('content_hash_mismatch');

  if (s.snapshotChainIndex > 1) {
    if (!s.parentSnapshotId || !s.parentSnapshotContentHash) {
      status = 'broken_parent_link';
      reasonCodes.push('missing_parent_link_metadata');
    } else {
      const p = await getSnapshot(flowId, s.parentSnapshotId);
      if (p.error || p.snapshot.snapshotContentHash !== s.parentSnapshotContentHash) {
        status = 'broken_parent_link';
        reasonCodes.push('parent_hash_reference_mismatch');
      }
    }
  }

  return {
    flowId,
    snapshotId,
    status,
    reasonCodes,
    storedContentHash: s.snapshotContentHash,
    recomputedContentHash: hash,
    snapshotHashVersion: s.snapshotHashVersion,
    parentSnapshotId: s.parentSnapshotId,
    parentSnapshotContentHash: s.parentSnapshotContentHash,
    snapshotChainIndex: s.snapshotChainIndex
  };
}

export async function recomputeFlowSnapshotIntegrity(flowId) {
  const snaps = await readAllSnapshots(flowId);
  const out = [];
  for (const s of snaps) out.push(await verifySnapshotIntegrity(flowId, s.snapshotId));
  const firstBroken = out.find((x) => x.status !== 'match');
  return {
    flowId,
    totalSnapshots: out.length,
    matched: out.filter((x) => x.status === 'match').length,
    mismatched: out.filter((x) => x.status === 'mismatch').length,
    brokenChainLinks: out.filter((x) => x.status === 'broken_parent_link').length,
    missingHash: out.filter((x) => x.status === 'missing_hash').length,
    firstBrokenSnapshotId: firstBroken?.snapshotId || null,
    snapshots: out
  };
}
