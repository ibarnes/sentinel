import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getShotList, exportShotList } from './shotListService.js';
import { listEditIntents, applyEditIntentsToShotList, diffShotLists } from './editIntentService.js';
import { getShotListSnapshot } from './shotListSnapshotService.js';
import { getLatestTrustPublication } from '../script/reviewedSnapshotTrustPublicationService.js';

const pexec = promisify(execFile);

function id() { return `ap_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

async function resolveShotList(shotListId, shotListSnapshotId = null) {
  if (shotListSnapshotId) {
    const s = await getShotListSnapshot(shotListId, shotListSnapshotId);
    if (s.error) return s;
    return { baseline: s.snapshot.frozenShotList, effective: s.snapshot.frozenShotList, diff: { changedShotCount: 0, changedSceneCount: 0, firstDivergence: null }, snapshot: s.snapshot };
  }
  const got = await getShotList(shotListId);
  if (got.error) return got;
  const baseline = got.shotList;
  const intents = (await listEditIntents(shotListId)).editIntents || [];
  const effective = applyEditIntentsToShotList(baseline, intents);
  return { baseline, effective, diff: diffShotLists(baseline, effective), snapshot: null, intents };
}

export async function buildAssemblyPackage({ shotListId, shotListSnapshotId = null, format = 'assembly_package', requireLatestTrustPublication = false } = {}) {
  const resolved = await resolveShotList(shotListId, shotListSnapshotId);
  if (resolved.error) return resolved;

  const trust = await getLatestTrustPublication(resolved.effective.sourceRef?.scriptId || '');
  if (requireLatestTrustPublication && trust.error) return { error: 'latest_trust_publication_missing' };

  const manifest = {
    assemblyPackageId: id(),
    packageVersion: 'v1',
    sourceRefs: resolved.effective.sourceRef,
    shotListId,
    shotListSnapshotId: shotListSnapshotId || null,
    reviewedScriptSnapshotId: trust.error ? null : trust.trustPublication.latestReviewedSnapshotId,
    trustRefs: trust.error ? null : { trustPublicationId: trust.trustPublication.trustPublicationId, chainHeadDigest: trust.trustPublication.chainHeadDigest },
    exportReadinessState: {
      trustPublicationAvailable: !trust.error,
      trustPublicationSignatureStatus: trust.error ? 'missing' : trust.trustPublication.trustPublicationSignatureStatus
    },
    createdAt: new Date().toISOString()
  };

  const shotListJson = exportShotList(resolved.effective, 'json').content;
  const shotListMd = exportShotList(resolved.effective, 'markdown').content;
  const payload = {
    'assembly-manifest.json': manifest,
    'shot-list.json': JSON.parse(shotListJson),
    'shot-list.md': shotListMd,
    'trust-summary.json': trust.error ? { status: 'missing' } : trust.trustPublication,
    'integrity-summary.json': resolved.diff,
    'referenced-asset-index.json': {
      assets: (resolved.effective.scenes || []).flatMap((s) => (s.shots || []).map((h) => ({ shotId: h.shotId, sourceAssetRef: h.sourceAssetRef, highlightRef: h.highlightRef })))
    }
  };

  if (format === 'json') {
    return { contentType: 'application/json', filename: `${shotListId}-assembly.json`, content: JSON.stringify(payload, null, 2) };
  }
  if (format !== 'assembly_package') return { error: 'invalid_assembly_export_format' };

  const tmp = `/tmp/reveal-assembly-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(tmp, { recursive: true });
  for (const [name, value] of Object.entries(payload)) {
    const p = path.join(tmp, name);
    if (name.endsWith('.md')) await fs.writeFile(p, String(value));
    else await fs.writeFile(p, JSON.stringify(value, null, 2));
  }
  const zipPath = `${tmp}.zip`;
  await pexec('zip', ['-X', '-r', zipPath, '.', '-i', '*'], { cwd: tmp });
  const buffer = await fs.readFile(zipPath);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });

  return { contentType: 'application/zip', filename: `${shotListId}-assembly-package.zip`, buffer };
}
