import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { normalizeResultArtifactPayload, artifactPayloadDigest } from './resultArtifactNormalizationService.js';
import { verifyResultArtifact } from './resultArtifactVerificationService.js';
import { linkResultArtifactToReceipt } from './resultArtifactLinkingService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/execution-results';
const id = () => `era_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (executionResultArtifactId) => path.join(ROOT, `${executionResultArtifactId}.json`);

async function writeRow(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.executionResultArtifactId), JSON.stringify(row, null, 2), 'utf8');
}

export async function getExecutionResultArtifact(executionResultArtifactId) {
  try { return { executionResultArtifact: JSON.parse(await fs.readFile(fileFor(executionResultArtifactId), 'utf8')) }; }
  catch { return { error: 'execution_result_artifact_not_found' }; }
}

export async function listExecutionResultArtifacts(filters = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try {
      const r = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (filters.providerType && r.providerType !== filters.providerType) continue;
      if (filters.providerProfileId && r.providerProfileId !== filters.providerProfileId) continue;
      if (filters.artifactType && r.artifactType !== filters.artifactType) continue;
      if (filters.sourceExecutionReceiptId && r.sourceExecutionReceiptId !== filters.sourceExecutionReceiptId) continue;
      if (filters.sourceExternalExecutionRef && r.sourceExternalExecutionRef !== filters.sourceExternalExecutionRef) continue;
      if (filters.ingestionStatus && r.ingestionStatus !== filters.ingestionStatus) continue;
      if (filters.createdAfter && String(r.createdAt) < String(filters.createdAfter)) continue;
      rows.push(r);
    } catch {}
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { executionResultArtifacts: rows };
}

export async function createExecutionResultArtifact(input = {}) {
  if (!input.providerType || !input.providerProfileId) return { error: 'missing_provider_profile' };
  if (!input.artifactType) return { error: 'unsupported_artifact_type' };
  if (!input.artifactPayload || typeof input.artifactPayload !== 'object') return { error: 'malformed_artifact_payload' };

  const normalized = normalizeResultArtifactPayload({
    providerType: input.providerType,
    providerProfileId: input.providerProfileId,
    artifactType: input.artifactType,
    artifactPayload: input.artifactPayload
  });
  if (normalized.error) return { error: normalized.error, reasonCodes: normalized.reasonCodes || [normalized.error], ...(normalized.missingFields ? { missingFields: normalized.missingFields } : {}) };

  const digest = input.artifactDigest || artifactPayloadDigest(normalized.normalizedPayload);
  const verification = await verifyResultArtifact({
    providerType: input.providerType,
    providerProfileId: input.providerProfileId,
    artifactType: input.artifactType,
    artifactPayload: normalized.normalizedPayload,
    trustMetadata: input.trustMetadata || {},
    artifactDigest: digest,
    policyProfile: input.policyProfile || 'dev'
  });

  const row = {
    executionResultArtifactId: id(),
    createdAt: new Date().toISOString(),
    artifactVersion: 'v1',
    providerType: input.providerType,
    providerProfileId: input.providerProfileId,
    artifactType: input.artifactType,
    sourceExecutionReceiptId: input.sourceExecutionReceiptId || null,
    sourceProviderSubmissionContractId: input.sourceProviderSubmissionContractId || null,
    sourceExternalExecutionRef: input.sourceExternalExecutionRef || input.artifactPayload?.externalExecutionRef || null,
    artifactPayload: normalized.normalizedPayload,
    artifactDigest: digest,
    artifactDigestVersion: input.artifactDigestVersion || 'sha256-v1',
    trustMetadata: verification.trust || {
      artifactSignatureStatus: 'unsigned',
      artifactSignatureValid: null,
      artifactSigningKeyId: input.trustMetadata?.artifactSigningKeyId || null,
      artifactSigningAlgorithm: input.trustMetadata?.artifactSigningAlgorithm || 'HMAC-SHA256',
      artifactVerificationScope: 'result-artifact-payload-core',
      trustProfile: 'external_result_artifact_v1',
      artifactOriginStatus: 'unknown_origin'
    },
    ingestionStatus: 'stored_only',
    blockingReasons: [],
    warnings: verification.warnings || [],
    metadata: input.metadata || { deterministic: true }
  };

  if (['malformed_artifact','unsupported_artifact_type','capability_mismatch','invalid_signature'].includes(verification.status)) {
    row.ingestionStatus = verification.status === 'invalid_signature' ? 'policy_blocked' : verification.status;
    row.blockingReasons = verification.reasonCodes || [];
    await writeRow(row);
    return {
      executionResultArtifact: row,
      ingestionResult: {
        ingestionStatus: row.ingestionStatus,
        targetExecutionReceiptId: row.sourceExecutionReceiptId,
        targetProviderSubmissionContractId: row.sourceProviderSubmissionContractId,
        lifecycleEventId: null,
        artifactLinkSummary: { linked: false },
        structuralValidationStatus: verification.structuralValidationStatus,
        trustValidationStatus: verification.trustValidationStatus,
        reasonCodes: row.blockingReasons,
        warnings: row.warnings
      }
    };
  }

  const linked = await linkResultArtifactToReceipt(row);
  row.ingestionStatus = linked.ingestionStatus;
  row.blockingReasons = linked.ingestionStatus === 'applied' ? [] : (linked.reasonCodes || []);
  row.sourceExecutionReceiptId = linked.targetExecutionReceiptId || row.sourceExecutionReceiptId;
  row.sourceProviderSubmissionContractId = linked.targetProviderSubmissionContractId || row.sourceProviderSubmissionContractId;

  await writeRow(row);

  return {
    executionResultArtifact: row,
    ingestionResult: {
      ingestionStatus: row.ingestionStatus,
      targetExecutionReceiptId: row.sourceExecutionReceiptId,
      targetProviderSubmissionContractId: row.sourceProviderSubmissionContractId,
      lifecycleEventId: linked.lifecycleEventId || null,
      artifactLinkSummary: linked.artifactLinkSummary || { linked: false },
      structuralValidationStatus: verification.structuralValidationStatus,
      trustValidationStatus: verification.trustValidationStatus,
      reasonCodes: linked.reasonCodes || [],
      warnings: [...new Set([...(verification.warnings || []), ...(linked.warnings || [])])]
    }
  };
}

export function exportExecutionResultArtifact(row, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${row.executionResultArtifactId}.json`, content: JSON.stringify(row, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [
    `# Execution Result Artifact ${row.executionResultArtifactId}`,
    '',
    `- Provider: ${row.providerType}/${row.providerProfileId}`,
    `- Artifact Type: ${row.artifactType}`,
    `- Ingestion Status: ${row.ingestionStatus}`,
    `- Source Receipt: ${row.sourceExecutionReceiptId || 'none'}`,
    `- Source Submission: ${row.sourceProviderSubmissionContractId || 'none'}`,
    `- External Ref: ${row.sourceExternalExecutionRef || 'none'}`,
    `- Trust Origin: ${row.trustMetadata?.artifactOriginStatus || 'unknown_origin'}`,
    `- Digest: ${row.artifactDigest}`,
    `- Blocking: ${(row.blockingReasons || []).join(', ') || 'none'}`,
    `- Warnings: ${(row.warnings || []).join(', ') || 'none'}`
  ];
  return { contentType: 'text/markdown; charset=utf-8', filename: `${row.executionResultArtifactId}.md`, content: `${lines.join('\n')}\n` };
}
