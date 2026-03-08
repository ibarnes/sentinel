import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getRenderAdapterContract } from '../production/renderAdapterContractService.js';
import { getExternalVerifierProfile, latestExternalVerifierProfile } from './externalVerifierProfileService.js';
import { signAdmissionCertificate } from './handoffCertificationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/admission-certificates';
function id(){ return `ac_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function fileFor(admissionCertificateId){ return path.join(ROOT, `${admissionCertificateId}.json`); }
async function writeCert(c){ await fs.mkdir(ROOT,{recursive:true}); await fs.writeFile(fileFor(c.admissionCertificateId), JSON.stringify(c,null,2)); }
export async function getAdmissionCertificate(admissionCertificateId){ try{return {admissionCertificate: JSON.parse(await fs.readFile(fileFor(admissionCertificateId),'utf8'))};}catch{return {error:'admission_certificate_not_found'};} }

function digest(obj){ return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex'); }

export async function createAdmissionCertificate({ renderAdapterContractId = null, externalVerifierProfileId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  let adapter = null;
  if (renderAdapterContractId) {
    const got = await getRenderAdapterContract(renderAdapterContractId);
    if (got.error) return got;
    adapter = got.renderAdapterContract;
  }

  let external = null;
  if (externalVerifierProfileId) {
    const got = await getExternalVerifierProfile(externalVerifierProfileId);
    if (got.error) return got;
    external = got.externalVerifierProfile;
  } else {
    const got = await latestExternalVerifierProfile({ policyProfileId, verifierPackageId: adapter?.sourceRefs?.verifierPackageId || null, mode });
    if (got.error) return got;
    external = got.externalVerifierProfile;
  }

  const cert = {
    admissionCertificateId: id(),
    createdAt: new Date().toISOString(),
    certificateVersion: 'v1',
    targetRef: { renderAdapterContractId: renderAdapterContractId || null, externalVerifierProfileId: external.externalVerifierProfileId },
    adapterType: adapter?.adapterType || null,
    orchestrationProfile: adapter?.orchestrationProfile || external.policyProfileId,
    verifierPackageId: external.unifiedPackageSummary?.verifierPackageId || null,
    externalVerifierProfileId: external.externalVerifierProfileId,
    renderAdapterContractId: renderAdapterContractId || null,
    overallVerdict: external.overallVerdict,
    admissionDecision: external.admissionDecision,
    blockingReasons: external.blockingReasons || [],
    warnings: external.warnings || [],
    trustRefs: {
      attestationTrustPublicationId: external.attestationTrustPublicationSummary?.attestationTrustPublicationId || null,
      attestationChainHeadDigest: external.attestationTrustPublicationSummary?.attestationChainHeadDigest || null,
      policyManifestId: external.policyManifestSummary?.policyProfileId || null
    },
    readinessDigest: '',
    metadata: {
      adapterReadinessState: adapter?.readinessState || null,
      policyEvaluationResult: external.metadata?.policyEvaluationResult || null
    }
  };
  cert.readinessDigest = digest({
    verdict: cert.overallVerdict,
    decision: cert.admissionDecision,
    blockingReasons: cert.blockingReasons,
    warnings: cert.warnings,
    trustRefs: cert.trustRefs
  });

  const signed = await signAdmissionCertificate(cert);
  Object.assign(cert, signed);

  await writeCert(cert);
  return { admissionCertificate: cert };
}

export function exportAdmissionCertificate(cert, format = 'json') {
  if (format === 'json' || format === 'signed_certificate') {
    return { contentType: 'application/json', filename: `${cert.admissionCertificateId}${format === 'signed_certificate' ? '-signed' : ''}.json`, content: JSON.stringify(cert, null, 2) };
  }
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Admission Certificate ${cert.admissionCertificateId}`);
  lines.push('', `- Verdict: ${cert.overallVerdict}`);
  lines.push(`- Decision: ${cert.admissionDecision}`);
  lines.push(`- Blocking: ${(cert.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(cert.warnings || []).join(', ') || 'none'}`);
  lines.push(`- Signature Status: ${cert.certificateSignatureStatus}`);
  return { contentType: 'text/markdown; charset=utf-8', filename: `${cert.admissionCertificateId}.md`, content: lines.join('\n') + '\n' };
}

export async function latestAdmissionCertificate({ renderAdapterContractId = null, policyProfileId = 'dev', adapterType = null } = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  let latest = null;
  for (const f of files) {
    try {
      const c = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (renderAdapterContractId && c.renderAdapterContractId !== renderAdapterContractId) continue;
      if (policyProfileId && c.orchestrationProfile !== policyProfileId && c.metadata?.policyEvaluationResult?.orchestrationPolicyProfile !== policyProfileId) {}
      if (adapterType && c.adapterType !== adapterType) continue;
      if (!latest || String(c.createdAt).localeCompare(String(latest.createdAt)) > 0) latest = c;
    } catch {}
  }
  if (latest) return { admissionCertificate: latest };
  return createAdmissionCertificate({ renderAdapterContractId, policyProfileId, mode: 'latest' });
}
