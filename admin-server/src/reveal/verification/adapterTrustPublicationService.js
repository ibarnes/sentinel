import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getRenderAdapterContract } from '../production/renderAdapterContractService.js';
import { signAdapterManifest } from './handoffCertificationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/adapter-trust-publications';
const DIGEST_VERSION = 'sha256-v1';

function dirFor(renderAdapterContractId){ return path.join(ROOT, renderAdapterContractId); }
function fileFor(renderAdapterContractId, adapterTrustPublicationId){ return path.join(dirFor(renderAdapterContractId), `${adapterTrustPublicationId}.json`); }
function id(){ return `adpub_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }

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

function digest(pub){
  const p = canonicalize({
    renderAdapterContractId: pub.renderAdapterContractId,
    adapterType: pub.adapterType,
    orchestrationProfile: pub.orchestrationProfile,
    latestAdapterManifestDigest: pub.latestAdapterManifestDigest,
    previousPublishedAdapterHeadDigest: pub.previousPublishedAdapterHeadDigest || null,
    publicationVersion: pub.publicationVersion,
    publishedAt: pub.publishedAt
  });
  return crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

async function listRaw(renderAdapterContractId){
  const d = dirFor(renderAdapterContractId);
  const exists = await fs.access(d).then(()=>true).catch(()=>false);
  if (!exists) return [];
  const files = (await fs.readdir(d)).filter((f)=>f.endsWith('.json'));
  const out = [];
  for (const f of files){ try{ out.push(JSON.parse(await fs.readFile(path.join(d,f),'utf8'))); } catch {} }
  out.sort((a,b)=>String(a.publishedAt).localeCompare(String(b.publishedAt)));
  return out;
}

export async function publishAdapterTrust(renderAdapterContractId){
  const got = await getRenderAdapterContract(renderAdapterContractId);
  if (got.error) return got;
  const signed = await signAdapterManifest(got.renderAdapterContract);

  const manifestDigest = crypto.createHash('sha256').update(JSON.stringify(canonicalize(signed))).digest('hex');
  const prev = await getLatestAdapterTrustPublication(renderAdapterContractId);

  const pub = {
    adapterTrustPublicationId: id(),
    renderAdapterContractId,
    latestAdapterManifestDigest: manifestDigest,
    adapterType: got.renderAdapterContract.adapterType,
    orchestrationProfile: got.renderAdapterContract.orchestrationProfile,
    previousPublishedAdapterHeadDigest: prev.error ? null : prev.adapterTrustPublication.adapterChainHeadDigest,
    publicationVersion: 'v1',
    publishedAt: new Date().toISOString(),
    trustProfile: { trustProfileId: process.env.REVEAL_TRUST_PROFILE_ID || 'local_dev', trustProfileName: process.env.REVEAL_TRUST_PROFILE_NAME || 'Local Development' },
    publicationStatus: 'active',
    adapterManifestSignatureStatus: signed.adapterManifestSignatureStatus,
    adapterManifestSignatureValid: signed.adapterManifestSignatureValid
  };
  pub.adapterChainHeadDigestVersion = DIGEST_VERSION;
  pub.adapterChainHeadDigest = digest(pub);

  await fs.mkdir(dirFor(renderAdapterContractId), { recursive: true });
  const fp = fileFor(renderAdapterContractId, pub.adapterTrustPublicationId);
  const exists = await fs.access(fp).then(()=>true).catch(()=>false);
  if (exists) return { error: 'adapter_trust_publication_id_collision' };
  await fs.writeFile(fp, JSON.stringify(pub, null, 2));
  return { adapterTrustPublication: pub };
}

export async function listAdapterTrustPublications(renderAdapterContractId){
  const rows = await listRaw(renderAdapterContractId);
  return { adapterTrustPublications: rows };
}

export async function getAdapterTrustPublication(renderAdapterContractId, adapterTrustPublicationId){
  try { return { adapterTrustPublication: JSON.parse(await fs.readFile(fileFor(renderAdapterContractId, adapterTrustPublicationId), 'utf8')) }; }
  catch { return { error: 'adapter_trust_publication_not_found' }; }
}

export async function getLatestAdapterTrustPublication(renderAdapterContractId){
  const rows = await listRaw(renderAdapterContractId);
  if (!rows.length) return { error: 'adapter_trust_publication_not_found' };
  return { adapterTrustPublication: rows[rows.length - 1] };
}
