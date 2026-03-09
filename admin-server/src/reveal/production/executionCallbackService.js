import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { callbackPayloadDigest, canonicalizeCallbackValue, verifyExecutionCallback } from './callbackVerificationService.js';
import { reconcileExecutionCallback } from './callbackReconciliationService.js';
import { evaluateCallbackReplay } from './callbackReplayLedgerService.js';
import { evaluateCallbackPolicy, getCallbackPolicyProfile } from './callbackPolicyService.js';

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

function baseResult(callback, verification, replayStatus = 'not_evaluated', replayDecision = 'not_evaluated', keyRegistryStatus = 'not_evaluated', blockingReasons = [], warnings = []) {
  return {
    structuralValidationStatus: verification.structuralValidationStatus || verification.status,
    trustValidationStatus: verification.trustValidationStatus || 'not_evaluated',
    replayStatus,
    replayDecision,
    keyRegistryStatus,
    matchedCallbackSigningKeyId: verification.trust?.matchedCallbackSigningKeyId || callback.trustMetadata?.callbackSigningKeyId || null,
    blockingReasons,
    warnings,
    reconciliationStatus: callback.reconciliationStatus
  };
}

export async function createExecutionCallback(input = {}) {
  if (!input.providerType || !input.providerProfileId) return { error: 'missing_provider_profile' };
  if (!input.callbackType) return { error: 'unsupported_callback_type' };
  if (!input.callbackPayload || typeof input.callbackPayload !== 'object') return { error: 'malformed_callback_payload' };

  const policy = getCallbackPolicyProfile(input.callbackPolicyProfile || 'dev');
  const createdAt = new Date().toISOString();
  const digest = input.callbackDigest || callbackPayloadDigest(input.callbackPayload);

  const callback = {
    executionCallbackId: id(),
    createdAt,
    callbackVersion: 'v1',
    callbackPolicyProfile: policy.callbackPolicyProfile,
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
      callbackSigningKeyId: input.trustMetadata?.callbackSigningKeyId || null
    },
    policyEvaluationResult: null,
    replayStatus: null,
    replayDecision: null,
    reconciliationStatus: 'ignored',
    blockingReasons: [],
    warnings: [],
    metadata: input.metadata || { deterministic: true }
  };

  const verification = await verifyExecutionCallback({
    providerType: input.providerType,
    providerProfileId: input.providerProfileId,
    callbackType: input.callbackType,
    callbackPayload: input.callbackPayload,
    trustMetadata: input.trustMetadata || {},
    callbackDigest: digest,
    callbackPolicyProfile: policy.callbackPolicyProfile
  });

  callback.trustMetadata = {
    callbackSignatureStatus: verification.trust?.callbackSignatureStatus || 'unsigned',
    callbackSignatureValid: verification.trust?.callbackSignatureValid ?? null,
    callbackSigningKeyId: verification.trust?.matchedCallbackSigningKeyId || input.trustMetadata?.callbackSigningKeyId || null,
    callbackSigningAlgorithm: verification.trust?.callbackSigningAlgorithm || 'HMAC-SHA256',
    callbackVerificationScope: verification.trust?.callbackVerificationScope || 'callback-payload-core',
    trustProfile: verification.trust?.trustProfile || 'external_callback_v1',
    callbackOriginStatus: verification.trust?.callbackOriginStatus || 'unknown_origin',
    keyRegistryStatus: verification.trust?.keyRegistryStatus || 'not_evaluated'
  };

  if (['invalid_signature','malformed_callback','unsupported_callback_type','capability_mismatch'].includes(verification.status)) {
    callback.reconciliationStatus = verification.status === 'invalid_signature' ? 'policy_blocked' : verification.status;
    callback.blockingReasons = verification.reasonCodes || [];
    callback.warnings = verification.warnings || [];
    callback.policyEvaluationResult = 'block';
    callback.replayStatus = 'ignored_by_policy';
    callback.replayDecision = 'block';
    await writeRow(callback);
    return {
      executionCallback: callback,
      reconciliationResult: {
        ...baseResult(callback, verification, 'ignored_by_policy', 'block', callback.trustMetadata.keyRegistryStatus, callback.blockingReasons, callback.warnings),
        reconciliationStatus: callback.reconciliationStatus,
        targetExecutionReceiptId: callback.targetExecutionReceiptId,
        targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId,
        lifecycleEventId: null,
        stateBefore: null,
        stateAfter: null,
        reasonCodes: callback.blockingReasons,
        verifiedTrustStatus: callback.trustMetadata.callbackOriginStatus
      }
    };
  }

  const replay = await evaluateCallbackReplay({ callback, replayWindowPolicy: { windowSeconds: policy.replayWindowSeconds, profile: policy.callbackPolicyProfile } });
  const policyEval = evaluateCallbackPolicy({
    policyProfile: policy.callbackPolicyProfile,
    callbackType: callback.callbackType,
    trustValidationStatus: verification.trustValidationStatus,
    keyRegistryStatus: callback.trustMetadata.keyRegistryStatus,
    replayStatus: replay.replayStatus
  });

  callback.replayStatus = replay.replayStatus;
  callback.replayDecision = policyEval.replayDecision;
  callback.policyEvaluationResult = policyEval.policyEvaluationResult;
  callback.blockingReasons = policyEval.blockingReasons;
  callback.warnings = [...new Set([...(verification.warnings || []), ...(policyEval.warnings || [])])];

  if (policyEval.policyEvaluationResult === 'block') {
    callback.reconciliationStatus = 'policy_blocked';
    await writeRow(callback);
    return {
      executionCallback: callback,
      reconciliationResult: {
        ...baseResult(callback, verification, callback.replayStatus, callback.replayDecision, callback.trustMetadata.keyRegistryStatus, callback.blockingReasons, callback.warnings),
        reconciliationStatus: 'policy_blocked',
        targetExecutionReceiptId: callback.targetExecutionReceiptId,
        targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId,
        lifecycleEventId: null,
        stateBefore: null,
        stateAfter: null,
        reasonCodes: callback.blockingReasons,
        verifiedTrustStatus: callback.trustMetadata.callbackOriginStatus
      }
    };
  }

  if (policyEval.policyEvaluationResult === 'ignore') {
    callback.reconciliationStatus = 'ignored';
    await writeRow(callback);
    return {
      executionCallback: callback,
      reconciliationResult: {
        ...baseResult(callback, verification, callback.replayStatus, callback.replayDecision, callback.trustMetadata.keyRegistryStatus, callback.blockingReasons, callback.warnings),
        reconciliationStatus: 'ignored',
        targetExecutionReceiptId: callback.targetExecutionReceiptId,
        targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId,
        lifecycleEventId: null,
        stateBefore: null,
        stateAfter: null,
        reasonCodes: ['idempotent_duplicate_ignored'],
        verifiedTrustStatus: callback.trustMetadata.callbackOriginStatus
      }
    };
  }

  const reconciliationResult = await reconcileExecutionCallback(callback);
  callback.reconciliationStatus = reconciliationResult.reconciliationStatus;
  callback.targetExecutionReceiptId = reconciliationResult.targetExecutionReceiptId || callback.targetExecutionReceiptId;
  callback.targetProviderSubmissionContractId = reconciliationResult.targetProviderSubmissionContractId || callback.targetProviderSubmissionContractId;

  await writeRow(callback);
  return {
    executionCallback: callback,
    reconciliationResult: {
      ...reconciliationResult,
      ...baseResult(callback, verification, callback.replayStatus, callback.replayDecision, callback.trustMetadata.keyRegistryStatus, callback.blockingReasons, callback.warnings)
    }
  };
}

export async function replayCheckExecutionCallback(input = {}) {
  const callback = {
    executionCallbackId: 'preview',
    callbackDigest: callbackPayloadDigest(input.callbackPayload || {}),
    callbackDigestVersion: 'sha256-v1',
    callbackType: input.callbackType,
    providerType: input.providerType,
    providerProfileId: input.providerProfileId || 'default',
    targetExecutionReceiptId: input.targetExecutionReceiptId || null,
    targetProviderSubmissionContractId: input.targetProviderSubmissionContractId || null,
    externalExecutionRef: input.externalExecutionRef || null
  };
  const policy = getCallbackPolicyProfile(input.callbackPolicyProfile || 'dev');
  const replay = await evaluateCallbackReplay({ callback, replayWindowPolicy: { windowSeconds: policy.replayWindowSeconds, profile: policy.callbackPolicyProfile } });
  return {
    callbackPolicyProfile: policy.callbackPolicyProfile,
    replayStatus: replay.replayStatus,
    replayDecision: replay.replayDecision,
    replayLedgerRecord: replay.replayLedgerRecord
  };
}

export function exportExecutionCallback(row, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${row.executionCallbackId}.json`, content: JSON.stringify(row, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [
    `# Execution Callback ${row.executionCallbackId}`,
    '',
    `- Provider: ${row.providerType}/${row.providerProfileId}`,
    `- Policy: ${row.callbackPolicyProfile || 'dev'}`,
    `- Callback Type: ${row.callbackType}`,
    `- Reconciliation Status: ${row.reconciliationStatus}`,
    `- Replay Status: ${row.replayStatus || 'n/a'}`,
    `- Replay Decision: ${row.replayDecision || 'n/a'}`,
    `- Key Registry Status: ${row.trustMetadata?.keyRegistryStatus || 'n/a'}`,
    `- Target Receipt: ${row.targetExecutionReceiptId || 'none'}`,
    `- Trust Origin: ${row.trustMetadata?.callbackOriginStatus || 'unknown_origin'}`,
    `- Digest: ${row.callbackDigest}`,
    `- Blocking: ${(row.blockingReasons || []).join(', ') || 'none'}`,
    `- Warnings: ${(row.warnings || []).join(', ') || 'none'}`
  ];
  return { contentType: 'text/markdown; charset=utf-8', filename: `${row.executionCallbackId}.md`, content: `${lines.join('\n')}\n` };
}
