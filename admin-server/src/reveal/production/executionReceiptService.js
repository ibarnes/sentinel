import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getSigningContext } from '../services/packageSigningService.js';
import { getProviderSubmissionContract } from './providerSubmissionService.js';
import { appendLifecycleEvent, canTransition, eventTypeForAction, mapSchedulerStatus, nextStatusForAction } from './executionLifecycleService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/execution-receipts';
const id = () => `erc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (executionReceiptId) => path.join(ROOT, `${executionReceiptId}.json`);

const canonicalize = (v) => {
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
};

function signingPayload(receipt) {
  return canonicalize({
    executionReceiptId: receipt.executionReceiptId,
    receiptVersion: receipt.receiptVersion,
    providerSubmissionContractId: receipt.providerSubmissionContractId,
    providerAdapterId: receipt.providerAdapterId,
    providerType: receipt.providerType,
    providerProfileId: receipt.providerProfileId,
    submissionDigest: receipt.submissionDigest,
    submissionStatus: receipt.submissionStatus,
    schedulerStatus: receipt.schedulerStatus,
    externalExecutionRef: receipt.externalExecutionRef || null,
    responseSummary: receipt.responseSummary || null,
    policyEvaluation: receipt.policyEvaluation,
    blockingReasons: receipt.blockingReasons || [],
    warnings: receipt.warnings || [],
    lifecycleEvents: receipt.lifecycleEvents || [],
    lastCallbackId: receipt.lastCallbackId || null,
    lastCallbackType: receipt.lastCallbackType || null,
    lastCallbackAt: receipt.lastCallbackAt || null,
    callbackTrustStatus: receipt.callbackTrustStatus || 'none',
    callbackCount: Number(receipt.callbackCount || 0),
    callbackWarningsSummary: receipt.callbackWarningsSummary || [],
    lastCallbackReplayStatus: receipt.lastCallbackReplayStatus || null,
    lastCallbackKeyRegistryStatus: receipt.lastCallbackKeyRegistryStatus || null,
    lastCallbackOutcome: receipt.lastCallbackOutcome || null
  });
}

export function receiptDigest(receipt) {
  return crypto.createHash('sha256').update(JSON.stringify(signingPayload(receipt))).digest('hex');
}

async function signReceipt(receipt) {
  const ctx = await getSigningContext();
  if (!ctx.enabled) {
    return {
      ...receipt,
      receiptSignature: null,
      receiptSignatureVersion: 'execution-receipt-sig-v1',
      receiptSigningKeyId: null,
      receiptSigningAlgorithm: 'RSA-SHA256',
      receiptSignatureStatus: 'unsigned',
      receiptSignatureValid: null,
      receiptVerificationScope: 'execution-receipt-core',
      unsignedReason: ctx.unsignedReason || 'missing_key'
    };
  }
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(signingPayload(receipt)));
  signer.end();
  const sig = signer.sign(ctx.privateKey, 'base64');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(JSON.stringify(signingPayload(receipt)));
  verifier.end();
  const valid = verifier.verify(ctx.publicKey, sig, 'base64');
  return {
    ...receipt,
    receiptSignature: sig,
    receiptSignatureVersion: 'execution-receipt-sig-v1',
    receiptSigningKeyId: ctx.signingKeyId,
    receiptSigningAlgorithm: ctx.signingAlgorithm,
    receiptSignatureStatus: 'signed',
    receiptSignatureValid: valid,
    receiptVerificationScope: 'execution-receipt-core'
  };
}

async function writeReceipt(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.executionReceiptId), JSON.stringify(row, null, 2), 'utf8');
}

export async function getExecutionReceipt(executionReceiptId) {
  try {
    return { executionReceipt: JSON.parse(await fs.readFile(fileFor(executionReceiptId), 'utf8')) };
  } catch {
    return { error: 'execution_receipt_not_found' };
  }
}

export async function createExecutionReceipt({ providerSubmissionContractId = null, requestSummary = null } = {}) {
  if (!providerSubmissionContractId) return { error: 'missing_provider_submission_contract_id' };
  const sub = await getProviderSubmissionContract(providerSubmissionContractId);
  if (sub.error) return sub;

  const s = sub.providerSubmissionContract;
  const now = new Date().toISOString();
  let receipt = {
    executionReceiptId: id(),
    createdAt: now,
    updatedAt: now,
    receiptVersion: 'v1',
    providerSubmissionContractId: s.providerSubmissionContractId,
    providerAdapterId: s.providerAdapterId,
    providerType: s.providerType,
    providerProfileId: s.providerProfileId,
    submissionDigest: s.payloadDigest,
    submissionStatus: 'prepared',
    schedulerStatus: 'not_dispatched',
    externalExecutionRef: null,
    requestSummary: requestSummary || {
      targetSystem: s.targetEndpointProfile || 'none',
      requestedAt: now,
      dispatchMode: s.submissionMode,
      payloadDigest: s.payloadDigest,
      artifactCounts: {
        stages: s.submissionPayload?.executionStages?.length || 0,
        jobs: s.submissionPayload?.executionJobs?.length || 0,
        inputs: s.submissionPayload?.inputArtifactRefs?.length || 0,
        outputs: s.submissionPayload?.outputTargetRefs?.length || 0
      }
    },
    responseSummary: null,
    policyEvaluation: s.policyEvaluation,
    blockingReasons: [...(s.blockingReasons || [])],
    warnings: [...(s.warnings || [])],
    lifecycleEvents: [],
    lastCallbackId: null,
    lastCallbackType: null,
    lastCallbackAt: null,
    callbackTrustStatus: 'none',
    callbackCount: 0,
    callbackWarningsSummary: [],
    lastCallbackReplayStatus: null,
    lastCallbackKeyRegistryStatus: null,
    lastCallbackOutcome: null,
    metadata: { deterministic: true }
  };

  receipt.lifecycleEvents = appendLifecycleEvent(receipt, {
    eventType: 'receipt_created',
    actorType: 'system',
    summary: 'Execution receipt created from provider submission contract',
    statusBefore: null,
    statusAfter: 'prepared',
    metadata: { providerSubmissionContractId }
  });

  receipt = await signReceipt(receipt);
  await writeReceipt(receipt);
  return { executionReceipt: receipt };
}

export async function patchExecutionReceipt(executionReceiptId, patch = {}) {
  const out = await getExecutionReceipt(executionReceiptId);
  if (out.error) return out;
  let receipt = out.executionReceipt;

  const action = patch.action || null;
  if (!action) return { error: 'malformed_lifecycle_patch' };

  const before = receipt.submissionStatus;
  const after = nextStatusForAction(action, before);
  if (action !== 'addNote' && before === after) return { error: 'illegal_status_transition', currentStatus: before, attemptedAction: action };
  if (action !== 'addNote' && !canTransition(before, after)) return { error: 'illegal_status_transition', currentStatus: before, attemptedStatus: after };

  if (action === 'recordHandoff' && patch.externalExecutionRef) receipt.externalExecutionRef = String(patch.externalExecutionRef);
  if (action === 'recordAcknowledgement' || action === 'recordRejection' || action === 'closeSuccess' || action === 'closeFailure') {
    receipt.responseSummary = {
      ...(receipt.responseSummary || {}),
      acknowledgedAt: new Date().toISOString(),
      externalExecutionRef: patch.externalExecutionRef || receipt.externalExecutionRef || null,
      providerMessage: patch.providerMessage || null,
      responseCode: patch.responseCode || null,
      errorClass: patch.errorClass || null,
      providerResult: patch.providerResult || null
    };
    if (patch.externalExecutionRef) receipt.externalExecutionRef = patch.externalExecutionRef;
  }

  if (action !== 'addNote') {
    receipt.submissionStatus = after;
    receipt.schedulerStatus = mapSchedulerStatus(after);
  }

  receipt.lifecycleEvents = appendLifecycleEvent(receipt, {
    eventType: eventTypeForAction(action),
    actorType: patch.actorType || 'operator',
    summary: patch.summary || action,
    statusBefore: before,
    statusAfter: action === 'addNote' ? before : after,
    metadata: patch.metadata || {}
  });

  if (patch.callbackUpdate && typeof patch.callbackUpdate === 'object') {
    receipt.lastCallbackId = patch.callbackUpdate.lastCallbackId || receipt.lastCallbackId || null;
    receipt.lastCallbackType = patch.callbackUpdate.lastCallbackType || receipt.lastCallbackType || null;
    receipt.lastCallbackAt = patch.callbackUpdate.lastCallbackAt || receipt.lastCallbackAt || null;
    receipt.callbackTrustStatus = patch.callbackUpdate.callbackTrustStatus || receipt.callbackTrustStatus || 'none';
    receipt.callbackCount = Number(receipt.callbackCount || 0) + (Number(patch.callbackUpdate.incrementCallbackCount || 0) || 0);
    const warnings = Array.isArray(patch.callbackUpdate.callbackWarningsSummary) ? patch.callbackUpdate.callbackWarningsSummary : [];
    receipt.callbackWarningsSummary = [...new Set([...(receipt.callbackWarningsSummary || []), ...warnings])].slice(0, 20);
    receipt.lastCallbackReplayStatus = patch.callbackUpdate.lastCallbackReplayStatus || receipt.lastCallbackReplayStatus || null;
    receipt.lastCallbackKeyRegistryStatus = patch.callbackUpdate.lastCallbackKeyRegistryStatus || receipt.lastCallbackKeyRegistryStatus || null;
    receipt.lastCallbackOutcome = patch.callbackUpdate.lastCallbackOutcome || receipt.lastCallbackOutcome || null;
  }

  receipt.updatedAt = new Date().toISOString();
  receipt = await signReceipt(receipt);
  await writeReceipt(receipt);
  return { executionReceipt: receipt };
}

export async function listExecutionReceipts({ providerType = null, submissionStatus = null, schedulerStatus = null, providerProfileId = null, createdAfter = null } = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try {
      const row = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (providerType && row.providerType !== providerType) continue;
      if (submissionStatus && row.submissionStatus !== submissionStatus) continue;
      if (schedulerStatus && row.schedulerStatus !== schedulerStatus) continue;
      if (providerProfileId && row.providerProfileId !== providerProfileId) continue;
      if (createdAfter && String(row.createdAt) < String(createdAfter)) continue;
      rows.push(row);
    } catch {}
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { executionReceipts: rows };
}

export function exportExecutionReceipt(receipt, format = 'json') {
  if (format === 'json' || format === 'signed_receipt') return { contentType: 'application/json', filename: `${receipt.executionReceiptId}${format === 'signed_receipt' ? '-signed' : ''}.json`, content: JSON.stringify(receipt, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Execution Receipt ${receipt.executionReceiptId}`);
  lines.push('', `- Submission: ${receipt.providerSubmissionContractId}`);
  lines.push(`- Submission Status: ${receipt.submissionStatus}`);
  lines.push(`- Scheduler Status: ${receipt.schedulerStatus}`);
  lines.push(`- External Ref: ${receipt.externalExecutionRef || 'none'}`);
  lines.push(`- Signature: ${receipt.receiptSignatureStatus || 'unsigned'}`);
  lines.push(`- Last Callback: ${receipt.lastCallbackType || 'none'} (${receipt.lastCallbackId || 'n/a'}) @ ${receipt.lastCallbackAt || 'n/a'}`);
  lines.push(`- Callback Trust: ${receipt.callbackTrustStatus || 'none'} • Count: ${receipt.callbackCount || 0}`);
  lines.push(`- Callback Replay: ${receipt.lastCallbackReplayStatus || 'n/a'} • Key Registry: ${receipt.lastCallbackKeyRegistryStatus || 'n/a'} • Outcome: ${receipt.lastCallbackOutcome || 'n/a'}`);
  lines.push(`- Callback Warnings: ${(receipt.callbackWarningsSummary || []).join(', ') || 'none'}`);
  lines.push(`- Blocking: ${(receipt.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(receipt.warnings || []).join(', ') || 'none'}`);
  lines.push('', '## Lifecycle Events');
  lines.push('```json');
  lines.push(JSON.stringify(receipt.lifecycleEvents || [], null, 2));
  lines.push('```');
  return { contentType: 'text/markdown; charset=utf-8', filename: `${receipt.executionReceiptId}.md`, content: `${lines.join('\n')}\n` };
}
