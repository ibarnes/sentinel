import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getFlow } from './retrievalService.js';
import { getSnapshot, verifySnapshotIntegrity } from './snapshotService.js';
import { exportReviewedFlow, exportSnapshot } from './exportService.js';
import {
  getSigningContext,
  signPayload,
  verifyVerificationMetadata,
  buildSigningPayload,
  PACKAGE_SIGNATURE_VERSION
} from './packageSigningService.js';

const pexecFile = promisify(execFile);
const WORKSPACE = '/home/ec2-user/.openclaw/workspace';

function sha256(v) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function assetFsPathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (!url.startsWith('/reveal/storage/assets/')) return null;
  const rel = url.replace('/reveal/storage/assets/', '');
  return path.join(WORKSPACE, 'reveal', 'storage', 'assets', rel);
}

function collectAssetsFromSteps(steps = []) {
  const entries = [];
  for (const s of steps) {
    const items = [
      ['screenshots', s.screenshots?.beforeUrl],
      ['screenshots', s.screenshots?.afterUrl],
      ['highlights', s.screenshots?.highlightedUrl]
    ];
    for (const [kind, url] of items) {
      const fsPath = assetFsPathFromUrl(url);
      if (!fsPath) continue;
      entries.push({ kind, url, fsPath, stepId: s.id });
    }
  }
  return entries;
}

async function writeJson(p, v) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2));
}

async function buildPackageCore({ packageType, flowId, snapshotId = null }) {
  let sourceType = 'live_reviewed';
  let flow;
  let snapshot = null;
  let integrity;

  if (packageType === 'reviewed_flow') {
    const got = await getFlow(flowId, 'preferred');
    if (!got) return { error: 'flow_not_found' };
    flow = got.flow;
    integrity = {
      replayIntegritySummary: {
        matched: (flow.steps || []).filter((s) => s.metadata?.replayIntegrityStatus === 'match').length,
        mismatched: (flow.steps || []).filter((s) => s.metadata?.replayIntegrityStatus === 'mismatch').length,
        unreplayable: (flow.steps || []).filter((s) => s.metadata?.replayIntegrityStatus === 'unreplayable_step').length,
        missing: (flow.steps || []).filter((s) => s.metadata?.replayIntegrityStatus === 'missing_baseline_checksum').length
      }
    };
  } else if (packageType === 'snapshot') {
    const got = await getSnapshot(flowId, snapshotId);
    if (got.error) return got;
    snapshot = got.snapshot;
    flow = snapshot.reviewedFlow;
    sourceType = 'immutable_snapshot';
    integrity = await verifySnapshotIntegrity(flowId, snapshotId);
  } else {
    return { error: 'invalid_package_type' };
  }

  return { flow, snapshot, sourceType, integrity };
}

async function applySignatureMetadata(manifest) {
  const ctx = await getSigningContext();
  manifest.packageSignatureVersion = PACKAGE_SIGNATURE_VERSION;
  manifest.packageVerificationScope = ['packageFormat','packageVersion','packageType','flowId','snapshotId','reviewVersion','snapshotChainIndex','contentHash','packageContentHash'];
  manifest.signingAlgorithm = ctx.signingAlgorithm || 'RSA-SHA256';
  manifest.signingKeyId = ctx.signingKeyId || null;

  if (!ctx.enabled) {
    manifest.signatureStatus = 'unsigned';
    manifest.unsignedReason = ctx.unsignedReason || 'missing_key';
    manifest.packageSignature = null;
    return { manifest, verification: { status: 'unsigned', reasonCodes: [manifest.unsignedReason] } };
  }

  const signature = signPayload(manifest, ctx);
  manifest.packageSignature = signature;
  manifest.signatureStatus = 'signed';

  const verification = verifyVerificationMetadata(manifest, ctx);
  if (verification.status !== 'verified') manifest.signatureStatus = 'verification_failed';

  return { manifest, verification };
}

async function buildPackage({ packageType, flowId, snapshotId = null }) {
  const core = await buildPackageCore({ packageType, flowId, snapshotId });
  if (core.error) return core;
  const { flow, snapshot, sourceType, integrity } = core;

  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'revealpkg-'));
  const pkgDir = path.join(tmpRoot, 'package');
  await fs.mkdir(pkgDir, { recursive: true });

  const jsonName = packageType === 'snapshot' ? 'snapshot.json' : 'reviewed-flow.json';
  const mdName = packageType === 'snapshot' ? 'snapshot.md' : 'reviewed-flow.md';

  const jsonExport = packageType === 'snapshot'
    ? await exportSnapshot(flowId, snapshotId, 'json')
    : await exportReviewedFlow(flowId, 'json');
  const mdExport = packageType === 'snapshot'
    ? await exportSnapshot(flowId, snapshotId, 'markdown')
    : await exportReviewedFlow(flowId, 'markdown');

  await fs.writeFile(path.join(pkgDir, jsonName), jsonExport.content, 'utf8');
  await fs.writeFile(path.join(pkgDir, mdName), mdExport.content, 'utf8');

  const assets = collectAssetsFromSteps(flow.steps || []);
  const includedAssets = [];
  const omittedAssets = [];
  for (const a of assets) {
    const ok = await exists(a.fsPath);
    if (!ok) {
      omittedAssets.push({ url: a.url, reason: 'missing_asset_file', stepId: a.stepId });
      continue;
    }
    const base = a.kind === 'highlights' ? 'assets/highlights' : 'assets/screenshots';
    const relName = `${a.stepId}-${path.basename(a.fsPath)}`;
    const out = path.join(pkgDir, base, relName);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.copyFile(a.fsPath, out);
    includedAssets.push({ sourceUrl: a.url, packagePath: `${base}/${relName}`, stepId: a.stepId });
  }

  const manifest = {
    packageFormat: 'revealpkg',
    packageVersion: 1,
    packageType,
    flowId,
    snapshotId: snapshot?.snapshotId || null,
    reviewVersion: flow.reviewVersion || flow.version || 1,
    snapshotChainIndex: snapshot?.snapshotChainIndex || null,
    createdAt: new Date().toISOString(),
    contentHash: snapshot?.snapshotContentHash || null,
    replayIntegritySummary: integrity?.replayIntegritySummary || integrity || null,
    sourceType,
    screenshotCoverageSummary: {
      totalSteps: (flow.steps || []).length,
      withBefore: (flow.steps || []).filter((s) => s.screenshots?.beforeUrl).length,
      withAfter: (flow.steps || []).filter((s) => s.screenshots?.afterUrl).length,
      withHighlight: (flow.steps || []).filter((s) => s.screenshots?.highlightedUrl).length
    },
    includedAssetCounts: {
      total: includedAssets.length,
      screenshots: includedAssets.filter((x) => x.packagePath.includes('/screenshots/')).length,
      highlights: includedAssets.filter((x) => x.packagePath.includes('/highlights/')).length
    },
    artifacts: [
      'manifest.json',
      jsonName,
      mdName,
      'integrity.json',
      ...includedAssets.map((x) => x.packagePath)
    ],
    omittedAssets
  };

  manifest.packageContentHash = sha256(JSON.stringify({
    inventory: manifest.artifacts.slice().sort(),
    packageType,
    flowId,
    snapshotId: snapshot?.snapshotId || null,
    contentHash: manifest.contentHash || null
  }));

  const signed = await applySignatureMetadata(manifest);
  const finalManifest = signed.manifest;

  const integrityPayload = {
    ...integrity,
    verificationMetadata: {
      signatureStatus: finalManifest.signatureStatus,
      signingKeyId: finalManifest.signingKeyId,
      signingAlgorithm: finalManifest.signingAlgorithm,
      packageSignatureVersion: finalManifest.packageSignatureVersion,
      packageSignature: finalManifest.packageSignature,
      packageVerificationScope: finalManifest.packageVerificationScope,
      packageContentHash: finalManifest.packageContentHash,
      integrityPackageContentHash: finalManifest.packageContentHash
    },
    verificationResult: signed.verification
  };

  await writeJson(path.join(pkgDir, 'integrity.json'), integrityPayload);
  await writeJson(path.join(pkgDir, 'manifest.json'), finalManifest);

  const fileBase = packageType === 'snapshot' ? `${flowId}-${snapshot?.snapshotId}` : `${flowId}-reviewed`;
  const outZip = path.join(tmpRoot, `${fileBase}.revealpkg.zip`);
  await pexecFile('zip', ['-X', '-r', outZip, '.'], { cwd: pkgDir });

  return {
    contentType: 'application/zip',
    filename: `${fileBase}.revealpkg.zip`,
    archivePath: outZip,
    cleanupDir: tmpRoot,
    manifest: finalManifest,
    verificationMetadata: integrityPayload.verificationMetadata,
    verificationResult: integrityPayload.verificationResult
  };
}

export async function buildReviewedPackage(flowId) {
  return buildPackage({ packageType: 'reviewed_flow', flowId });
}

export async function buildSnapshotPackage(flowId, snapshotId) {
  return buildPackage({ packageType: 'snapshot', flowId, snapshotId });
}

export async function getReviewedPackageVerificationMetadata(flowId) {
  const pkg = await buildReviewedPackage(flowId);
  if (pkg.error) return pkg;
  const out = {
    flowId,
    packageType: 'reviewed_flow',
    manifestCore: buildSigningPayload(pkg.manifest),
    verificationMetadata: pkg.verificationMetadata,
    verificationResult: pkg.verificationResult
  };
  await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
  return out;
}

export async function getSnapshotPackageVerificationMetadata(flowId, snapshotId) {
  const pkg = await buildSnapshotPackage(flowId, snapshotId);
  if (pkg.error) return pkg;
  const out = {
    flowId,
    snapshotId,
    packageType: 'snapshot',
    manifestCore: buildSigningPayload(pkg.manifest),
    verificationMetadata: pkg.verificationMetadata,
    verificationResult: pkg.verificationResult
  };
  await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
  return out;
}
