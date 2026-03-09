import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { callbackPayloadDigest, canonicalizeCallbackValue, verifyExecutionCallback } from './callbackVerificationService.js';
import { reconcileExecutionCallback } from './callbackReconciliationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/execution-callbacks';
const id = () => `ecb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (executionCallbackId) => path.join(ROOT, `${executionCallbackId}.json`);

async function writeRow(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.executionCallbackId), JSON.stringify(row, null, 2), 'utf8');
}

export async function getExecutionCallback(executionCallbackId) {
  try { return { executionCallback: JSON.parse(await fs.readFile(fileFor(executionCallbackId), 'utf8')) }; }
  catch { return { error: 'execution_callback_not_found' }; }
}

export async function listExecutionCallbacks() {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try { rows.push(JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'))); } catch {}
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { executionCallbacks: rows };
}

export async function createExecutionCallback(input = {}) {
  if (!input.providerType || !input.providerProfileId) return { error: 'missing_provider_profile' };
  if (!input.callbackType) return { error: 'unsupported_callback_type' };
  if (!input.callbackPayload || typeof input.callbackPayload !== 'object') return { error: 'malformed_callback_payload' };

  const createdAt = new Date().toISOString();
  const digest = input.callbackDigest || callbackPayloadDigest(input.callbackPayload);
  const verification = verifyExecutionCallback({
    providerType: input.providerType,
    providerProfileId: input.providerProfileId,
    callbackType: input.callbackType,
    callbackPayload: input.callbackPayload,
    trustMetadata: input.trustMetadata || {},
    callbackDigest: digest
  });

  const callback = {
    executionCallbackId: id(),
    createdAt,
    callbackVersion: 'v1',
    providerType: input.providerType,
    providerProfileId: input.providerProfileId,
    callbackType: input.callbackType,
    sourceSystem: input.sourceSystem || 'external_provider',
    targetExecutionReceiptId: input.targetExecutionReceiptId || null,
    targetProviderSubmissionContractId: input.targetProviderSubmissionContractId || null,
    externalExecutionRef: input.externalExecutionRef || input.callbackPayload?.externalExecutionRef || null,
    callbackPayload: canonicalizeCallbackValue(input.callbackPayload),
    callbackDigest: digest,
    callbackDigestVersion: input.callbackDigestVersion || 'sha256-v1',
    trustMetadata: {
      callbackSignatureStatus: verification.trust?.callbackSignatureStatus || 'unsigned',
      callbackSignatureValid: verification.trust?.callbackSignatureValid ?? null,
      callbackSigningKeyId: input.trustMetadata?.callbackSigningKeyId || null,
      callbackSigningAlgorithm: verification.trust?.callbackSigningAlgorithm || 'HMAC-SHA256',
      callbackVerificationScope: verification.trust?.callbackVerificationScope || 'callback-payload-core',
      trustProfile: verification.trust?.trustProfile || 'external_callback_v1',
      callbackOriginStatus: verification.trust?.callbackOriginStatus || 'unknown_origin'
    },
    reconciliationStatus: 'ignored',
    blockingReasons: [],
    warnings: verification.warnings || [],
    metadata: input.metadata || { deterministic: true }
  };

  if (['invalid_signature','malformed_callback','unsupported_callback_type','capability_mismatch'].includes(verification.status)) {
    callback.reconciliationStatus = verification.status === 'invalid_signature' ? 'policy_blocked' : verification.status;
    callback.blockingReasons = verification.reasonCodes || [];
    await writeRow(callback);
    return { executionCallback: callback, reconciliationResult: {
      reconciliationStatus: callback.reconciliationStatus,
      targetExecutionReceiptId: callback.targetExecutionReceiptId,
      targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId,
      lifecycleEventId: null,
      stateBefore: null,
      stateAfter: null,
      reasonCodes: callback.blockingReasons,
      warnings: callback.warnings,
      verifiedTrustStatus: callback.trustMetadata.callbackOriginStatus
    } };
  }

  const reconciliationResult = await reconcileExecutionCallback(callback);
  callback.reconciliationStatus = reconciliationResult.reconciliationStatus;
  callback.blockingReasons = reconciliationResult.reconciliationStatus === 'applied' ? [] : (reconciliationResult.reasonCodes || []);
  callback.targetExecutionReceiptId = reconciliationResult.targetExecutionReceiptId || callback.targetExecutionReceiptId;
  callback.targetProviderSubmissionContractId = reconciliationResult.targetProviderSubmissionContractId || callback.targetProviderSubmissionContractId;

  await writeRow(callback);
  return { executionCallback: callback, reconciliationResult };
}

export function exportExecutionCallback(row, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${row.executionCallbackId}.json`, content: JSON.stringify(row, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [
    `# Execution Callback ${row.executionCallbackId}`,
    '',
    `- Provider: ${row.providerType}/${row.providerProfileId}`,
    `- Callback Type: ${row.callbackType}`,
    `- Reconciliation Status: ${row.reconciliationStatus}`,
    `- Target Receipt: ${row.targetExecutionReceiptId || 'none'}`,
    `- Trust Origin: ${row.trustMetadata?.callbackOriginStatus || 'unknown_origin'}`,
    `- Digest: ${row.callbackDigest}`,
    `- Blocking: ${(row.blockingReasons || []).join(', ') || 'none'}`,
    `- Warnings: ${(row.warnings || []).join(', ') || 'none'}`
  ];
  return { contentType: 'text/markdown; charset=utf-8', filename: `${row.executionCallbackId}.md`, content: `${lines.join('\n')}\n` };
}
