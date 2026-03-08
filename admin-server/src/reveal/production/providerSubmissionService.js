import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getProviderAdapter } from './providerAdapterService.js';
import { manifestDigest, submissionPayloadDigest } from './submissionDigestService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/provider-submissions';
const id = () => `psc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (providerSubmissionContractId) => path.join(ROOT, `${providerSubmissionContractId}.json`);

async function writeRow(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.providerSubmissionContractId), JSON.stringify(row, null, 2), 'utf8');
}

export async function getProviderSubmissionContract(providerSubmissionContractId) {
  try {
    return { providerSubmissionContract: JSON.parse(await fs.readFile(fileFor(providerSubmissionContractId), 'utf8')) };
  } catch {
    return { error: 'provider_submission_contract_not_found' };
  }
}

function deriveReadiness(providerAdapter, mode) {
  if (providerAdapter.readinessState === 'blocked') return 'blocked';
  if (mode === 'scheduler_dispatch_ready' && providerAdapter.readinessState !== 'ready') return 'ready_with_warnings';
  return providerAdapter.readinessState;
}

export async function createProviderSubmissionContract({ providerAdapterId = null, submissionMode = 'dry_run', policyProfile = null, requestSummary = null } = {}) {
  if (!providerAdapterId) return { error: 'missing_provider_adapter_id' };
  if (!['dry_run', 'handoff_only', 'scheduler_dispatch_ready'].includes(submissionMode)) return { error: 'unsupported_submission_mode' };

  const adapterOut = await getProviderAdapter(providerAdapterId);
  if (adapterOut.error) return adapterOut;
  const providerAdapter = adapterOut.providerAdapter;

  const payload = {
    providerType: providerAdapter.providerType,
    providerProfileId: providerAdapter.providerProfile?.providerProfileId || 'default',
    manifestRef: {
      providerAdapterId: providerAdapter.providerAdapterId,
      sourceRenderAdapterContractId: providerAdapter.sourceRenderAdapterContractId
    },
    manifestDigest: manifestDigest(providerAdapter.providerManifest),
    executionStages: providerAdapter.providerManifest.executionStages,
    executionJobs: providerAdapter.providerManifest.executionJobs,
    inputArtifactRefs: (providerAdapter.providerManifest.inputArtifactMap || []).map((a) => ({ artifactId: a.artifactId, artifactType: a.artifactType, artifactRef: a.artifactRef })),
    outputTargetRefs: (providerAdapter.providerManifest.outputTargetMap || []).map((o) => ({ outputTargetId: o.outputTargetId, outputType: o.outputType, format: o.format, pathHint: o.pathHint })),
    orchestrationProfile: policyProfile || providerAdapter.providerManifest.policySummary?.orchestrationProfile || null,
    readinessState: deriveReadiness(providerAdapter, submissionMode),
    trustRefs: providerAdapter.providerManifest.trustRefs || {},
    admissionRefs: {
      externalVerifierProfileId: providerAdapter.sourceRefs?.externalVerifierProfileId || null,
      verifierPackageId: providerAdapter.sourceRefs?.verifierPackageId || null
    },
    handoffRefs: {
      providerAdapterId: providerAdapter.providerAdapterId
    },
    metadata: { deterministic: true }
  };

  const payloadDigest = submissionPayloadDigest(payload);
  const blockingReasons = [...new Set(providerAdapter.blockingReasons || [])];
  const warnings = [...new Set(providerAdapter.warnings || [])];

  const row = {
    providerSubmissionContractId: id(),
    createdAt: new Date().toISOString(),
    contractVersion: 'v1',
    providerAdapterId: providerAdapter.providerAdapterId,
    providerType: providerAdapter.providerType,
    providerProfileId: providerAdapter.providerProfile?.providerProfileId || 'default',
    submissionMode,
    targetEndpointProfile: submissionMode === 'dry_run' ? null : `${providerAdapter.providerType}/${providerAdapter.providerProfile?.providerProfileId || 'default'}`,
    readinessState: payload.readinessState,
    submissionPayload: payload,
    payloadDigest,
    payloadDigestVersion: 'sha256-v1',
    trustRefs: payload.trustRefs,
    policyEvaluation: providerAdapter.policyEvaluation,
    blockingReasons,
    warnings,
    requestSummary: requestSummary || null,
    metadata: { deterministic: true }
  };

  await writeRow(row);
  return { providerSubmissionContract: row };
}

export async function listProviderSubmissionContracts({ providerType = null, providerProfileId = null, readinessState = null, createdAfter = null } = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try {
      const row = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (providerType && row.providerType !== providerType) continue;
      if (providerProfileId && row.providerProfileId !== providerProfileId) continue;
      if (readinessState && row.readinessState !== readinessState) continue;
      if (createdAfter && String(row.createdAt) < String(createdAfter)) continue;
      rows.push(row);
    } catch {}
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { providerSubmissionContracts: rows };
}

export function exportProviderSubmissionContract(row, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${row.providerSubmissionContractId}.json`, content: JSON.stringify(row, null, 2) };
  if (format === 'submission_payload') return { contentType: 'application/json', filename: `${row.providerSubmissionContractId}-payload.json`, content: JSON.stringify(row.submissionPayload, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Provider Submission ${row.providerSubmissionContractId}`);
  lines.push('', `- Provider: ${row.providerType}/${row.providerProfileId}`);
  lines.push(`- Mode: ${row.submissionMode}`);
  lines.push(`- Readiness: ${row.readinessState}`);
  lines.push(`- Payload Digest: ${row.payloadDigest}`);
  lines.push(`- Blocking: ${(row.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(row.warnings || []).join(', ') || 'none'}`);
  return { contentType: 'text/markdown; charset=utf-8', filename: `${row.providerSubmissionContractId}.md`, content: `${lines.join('\n')}\n` };
}

export async function validateProviderSubmission({ providerSubmissionContractId = null, submissionPayload = null, policyProfile = null } = {}) {
  let payload = submissionPayload;
  if (!payload && providerSubmissionContractId) {
    const out = await getProviderSubmissionContract(providerSubmissionContractId);
    if (out.error) return out;
    payload = out.providerSubmissionContract.submissionPayload;
  }
  if (!payload || typeof payload !== 'object') return { status: 'malformed_submission_payload', reasonCodes: ['missing_payload'] };

  const required = ['providerType', 'providerProfileId', 'manifestRef', 'manifestDigest', 'executionStages', 'executionJobs', 'inputArtifactRefs', 'outputTargetRefs', 'orchestrationProfile', 'readinessState', 'trustRefs', 'admissionRefs', 'handoffRefs'];
  const missing = required.filter((k) => payload[k] === undefined);
  if (missing.length) return { status: 'malformed_submission_payload', reasonCodes: ['missing_required_fields'], missingFields: missing };

  const blocks = [];
  const warnings = [];
  const strict = (policyProfile || payload.orchestrationProfile) === 'production_verified';
  if (strict) {
    if (!payload.trustRefs?.sourceRefs?.externalVerifierProfileId && !payload.admissionRefs?.externalVerifierProfileId) blocks.push('missing_required_reference');
    if (!payload.manifestDigest) blocks.push('missing_required_reference');
    if (!payload.handoffRefs?.providerAdapterId) blocks.push('missing_required_reference');
  }

  if (!Array.isArray(payload.executionStages) || !Array.isArray(payload.executionJobs)) blocks.push('malformed_submission_payload');
  if (payload.readinessState === 'blocked') blocks.push('policy_mismatch');

  if (blocks.length) return { status: 'blocked', reasonCodes: [...new Set(blocks)] };
  if (warnings.length) return { status: 'valid_with_warnings', reasonCodes: [...new Set(warnings)] };
  return { status: 'valid', reasonCodes: ['submission_payload_valid'] };
}
