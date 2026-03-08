import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { buildAttestationReport } from './attestationReportService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/attestation-snapshots';
const HASH_VERSION = 'sha256-v1';

function dirFor(verifierPackageId){ return path.join(ROOT, verifierPackageId); }
function fileFor(verifierPackageId, attestationSnapshotId){ return path.join(dirFor(verifierPackageId), `${attestationSnapshotId}.json`); }
function id(){ return `ats_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

function canonicalize(v){
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (Array.isArray(v)) return v.map(canonicalize);
  if (typeof v === 'number') return Number.isFinite(v) ? Number(v.toFixed(6)) : null;
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) {
      const cv = canonicalize(v[k]);
      if (cv !== undefined) out[k] = cv;
    }
    return out;
  }
  return v;
}

function computeHash(snapshot){
  const payload = canonicalize({
    attestationSnapshotId: snapshot.attestationSnapshotId,
    verifierPackageId: snapshot.verifierPackageId,
    attestationReportId: snapshot.attestationReportId,
    createdAt: snapshot.createdAt,
    createdBy: snapshot.createdBy,
    policyProfile: snapshot.policyProfile,
    overallVerificationStatus: snapshot.overallVerificationStatus,
    parentAttestationSnapshotId: snapshot.parentAttestationSnapshotId,
    parentAttestationSnapshotContentHash: snapshot.parentAttestationSnapshotContentHash,
    attestationSnapshotChainIndex: snapshot.attestationSnapshotChainIndex,
    frozenAttestation: snapshot.frozenAttestation
  });
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

async function listRaw(verifierPackageId){
  const d = dirFor(verifierPackageId);
  const exists = await fs.access(d).then(()=>true).catch(()=>false);
  if (!exists) return [];
  const files = (await fs.readdir(d)).filter((f)=>f.endsWith('.json'));
  const out = [];
  for (const f of files){ try { out.push(JSON.parse(await fs.readFile(path.join(d,f),'utf8'))); } catch {} }
  out.sort((a,b)=>Number(a.attestationSnapshotChainIndex||0)-Number(b.attestationSnapshotChainIndex||0));
  return out;
}

export async function createAttestationSnapshot(verifierPackageId, { createdBy = null } = {}) {
  const built = await buildAttestationReport(verifierPackageId);
  if (built.error) return built;

  const prior = await listRaw(verifierPackageId);
  const parent = prior.length ? prior[prior.length - 1] : null;

  const snapshot = {
    attestationSnapshotId: id(),
    verifierPackageId,
    attestationReportId: built.attestationReport.attestationReportId,
    createdAt: new Date().toISOString(),
    createdBy,
    policyProfile: built.attestationReport.policyProfile,
    overallVerificationStatus: built.attestationReport.overallVerificationStatus,
    parentAttestationSnapshotId: parent?.attestationSnapshotId || null,
    parentAttestationSnapshotContentHash: parent?.attestationSnapshotContentHash || null,
    attestationSnapshotChainIndex: Number(parent?.attestationSnapshotChainIndex || 0) + 1,
    attestationSnapshotHashVersion: HASH_VERSION,
    frozenAttestation: built.attestationReport
  };

  snapshot.attestationSnapshotContentHash = computeHash(snapshot);
  snapshot.manifest = {
    attestationSnapshotId: snapshot.attestationSnapshotId,
    verifierPackageId,
    attestationReportId: snapshot.attestationReportId,
    policyProfile: snapshot.policyProfile,
    overallVerificationStatus: snapshot.overallVerificationStatus,
    attestationSnapshotContentHash: snapshot.attestationSnapshotContentHash,
    attestationSnapshotHashVersion: snapshot.attestationSnapshotHashVersion,
    parentAttestationSnapshotId: snapshot.parentAttestationSnapshotId,
    parentAttestationSnapshotContentHash: snapshot.parentAttestationSnapshotContentHash,
    attestationSnapshotChainIndex: snapshot.attestationSnapshotChainIndex,
    attestationSignatureStatus: snapshot.frozenAttestation?.attestationSignatureStatus || null,
    bundleManifestSignatureStatus: snapshot.frozenAttestation?.bundleManifestSignatureStatus || null,
    createdAt: snapshot.createdAt
  };

  await fs.mkdir(dirFor(verifierPackageId), { recursive: true });
  const fp = fileFor(verifierPackageId, snapshot.attestationSnapshotId);
  const exists = await fs.access(fp).then(()=>true).catch(()=>false);
  if (exists) return { error: 'attestation_snapshot_id_collision' };
  await fs.writeFile(fp, JSON.stringify(snapshot, null, 2), 'utf8');
  return { snapshot };
}

export async function listAttestationSnapshots(verifierPackageId) {
  const rows = await listRaw(verifierPackageId);
  return { snapshots: rows.map((s)=>({
    attestationSnapshotId: s.attestationSnapshotId,
    verifierPackageId: s.verifierPackageId,
    attestationReportId: s.attestationReportId,
    createdAt: s.createdAt,
    policyProfile: s.policyProfile,
    overallVerificationStatus: s.overallVerificationStatus,
    attestationSnapshotContentHash: s.attestationSnapshotContentHash,
    attestationSnapshotHashVersion: s.attestationSnapshotHashVersion,
    parentAttestationSnapshotId: s.parentAttestationSnapshotId,
    parentAttestationSnapshotContentHash: s.parentAttestationSnapshotContentHash,
    attestationSnapshotChainIndex: s.attestationSnapshotChainIndex,
    manifest: s.manifest
  })) };
}

export async function getAttestationSnapshot(verifierPackageId, attestationSnapshotId) {
  try { return { snapshot: JSON.parse(await fs.readFile(fileFor(verifierPackageId, attestationSnapshotId), 'utf8')) }; }
  catch { return { error: 'attestation_snapshot_not_found' }; }
}

export { computeHash as computeAttestationSnapshotHash };
