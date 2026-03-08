import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { getUnifiedVerifierPackage } from './unifiedVerifierService.js';
import { getPolicyManifest } from './policyManifestService.js';

const pexec = promisify(execFile);

export async function buildAttestationReport(verifierPackageId) {
  const out = await getUnifiedVerifierPackage(verifierPackageId);
  if (out.error) return out;
  const v = out.verifierPackage;

  const digest = crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
  const report = {
    attestationReportId: `ar_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    verifierPackageId,
    createdAt: new Date().toISOString(),
    sourceRefs: v.sourceRefs,
    policyProfile: v.orchestrationPolicySummary?.orchestrationPolicyProfile || null,
    domainResults: {
      script: v.scriptTrustSummary,
      shot: v.shotTrustSummary,
      voice: v.voiceTrustSummary,
      subtitle: v.subtitleProofSummary
    },
    overallVerificationStatus: v.overallVerificationStatus,
    blockingReasons: v.blockingReasons || [],
    warnings: v.warnings || [],
    trustPublications: {
      script: v.scriptTrustSummary?.trustPublication || null,
      voice: v.voiceTrustSummary?.trustPublication || null
    },
    integritySummaries: {
      script: v.scriptTrustSummary?.integritySummary || null,
      voice: v.voiceTrustSummary?.integritySummary || null
    },
    signatureSummaries: {
      policyManifestSignatureStatus: null,
      scriptTrustSignatureStatus: v.scriptTrustSummary?.trustPublication?.signatureStatus || null,
      voiceTrustSignatureStatus: v.voiceTrustSummary?.trustPublication?.signatureStatus || null
    },
    attestationDigest: digest,
    metadata: { verifierVersion: v.verifierVersion }
  };

  const pm = await getPolicyManifest(report.policyProfile || 'dev');
  report.signatureSummaries.policyManifestSignatureStatus = pm.error ? 'unknown' : pm.policyManifest.policyManifestSignatureStatus;

  return { attestationReport: report, policyManifest: pm.error ? null : pm.policyManifest, verifierPackage: v };
}

export async function exportAttestationBundle(verifierPackageId) {
  const built = await buildAttestationReport(verifierPackageId);
  if (built.error) return built;

  const bundleManifest = {
    bundleType: 'attestation_bundle',
    bundleVersion: 'v1',
    verifierPackageId,
    createdAt: new Date().toISOString(),
    files: [
      'manifest.json',
      'verifier-package.json',
      'attestation-report.json',
      'policy-manifest.json',
      'script-trust-summary.json',
      'shot-trust-summary.json',
      'voice-trust-summary.json',
      'subtitle-proof-summary.json',
      'integrity-summaries.json'
    ]
  };

  const payload = {
    'manifest.json': bundleManifest,
    'verifier-package.json': built.verifierPackage,
    'attestation-report.json': built.attestationReport,
    'policy-manifest.json': built.policyManifest,
    'script-trust-summary.json': built.verifierPackage.scriptTrustSummary,
    'shot-trust-summary.json': built.verifierPackage.shotTrustSummary,
    'voice-trust-summary.json': built.verifierPackage.voiceTrustSummary,
    'subtitle-proof-summary.json': built.verifierPackage.subtitleProofSummary,
    'integrity-summaries.json': {
      script: built.verifierPackage.scriptTrustSummary?.integritySummary || null,
      voice: built.verifierPackage.voiceTrustSummary?.integritySummary || null
    }
  };

  const tmp = `/tmp/reveal-attestation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  await fs.mkdir(tmp, { recursive: true });
  for (const [name, val] of Object.entries(payload)) {
    await fs.writeFile(path.join(tmp, name), JSON.stringify(val, null, 2));
  }
  const zipPath = `${tmp}.zip`;
  await pexec('zip', ['-X', '-r', zipPath, '.', '-i', '*'], { cwd: tmp });
  const buffer = await fs.readFile(zipPath);
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.rm(zipPath, { force: true });
  return { contentType: 'application/zip', filename: `${verifierPackageId}-attestation-bundle.zip`, buffer, payload };
}

export function exportVerifierPackage(v, format='json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${v.verifierPackageId}.json`, content: JSON.stringify(v, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Unified Verifier ${v.verifierPackageId}`);
  lines.push('', `- Created At: ${v.createdAt}`);
  lines.push(`- Version: ${v.verifierVersion}`);
  lines.push(`- Policy: ${v.orchestrationPolicySummary?.orchestrationPolicyProfile || 'n/a'}`);
  lines.push(`- Overall Status: ${v.overallVerificationStatus}`);
  lines.push(`- Blocking Reasons: ${(v.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(v.warnings || []).join(', ') || 'none'}`);
  lines.push('', '## Domain Summaries');
  lines.push('', '### Script');
  lines.push('```json'); lines.push(JSON.stringify(v.scriptTrustSummary, null, 2)); lines.push('```');
  lines.push('', '### Shot');
  lines.push('```json'); lines.push(JSON.stringify(v.shotTrustSummary, null, 2)); lines.push('```');
  lines.push('', '### Voice');
  lines.push('```json'); lines.push(JSON.stringify(v.voiceTrustSummary, null, 2)); lines.push('```');
  lines.push('', '### Subtitle');
  lines.push('```json'); lines.push(JSON.stringify(v.subtitleProofSummary, null, 2)); lines.push('```');
  return { contentType: 'text/markdown; charset=utf-8', filename: `${v.verifierPackageId}.md`, content: lines.join('\n') + '\n' };
}
