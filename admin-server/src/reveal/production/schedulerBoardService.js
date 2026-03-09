import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getOrchestrationProofCertificate, latestOrchestrationProofCertificate } from '../verification/orchestrationProofCertificateService.js';
import { getProviderSubmissionContract, listProviderSubmissionContracts } from './providerSubmissionService.js';
import { getExecutionReceipt, listExecutionReceipts, receiptDigest } from './executionReceiptService.js';
import { getLatestSubmissionTrustPublication } from './submissionTrustPublicationService.js';
import { getLatestReceiptTrustPublication } from './receiptTrustPublicationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/scheduler-boards';
const id = () => `sbrd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (schedulerBoardId) => path.join(ROOT, `${schedulerBoardId}.json`);

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

const boardDigestInput = (b) => canonicalize({
  targetRef: b.targetRef,
  orchestrationProofDigest: b.orchestrationProofSummary?.proofDigest || null,
  submissionDigest: b.providerSubmissionSummary?.payloadDigest || null,
  receiptDigest: b.executionReceiptSummary?.receiptDigest || null,
  submissionTrustHeadDigest: b.submissionTrustPublicationSummary?.submissionHeadDigest || null,
  receiptTrustHeadDigest: b.receiptTrustPublicationSummary?.receiptHeadDigest || null,
  policyProfileId: b.policyProfileId,
  dispatchDecision: b.dispatchDecision,
  blockingReasons: b.blockingReasons,
  warnings: b.warnings
});

function computeDispatch({ policyProfileId, proof, submission, receipt, subTrust, recTrust }) {
  const blocks = [];
  const warnings = [];

  if (!proof) blocks.push('missing_required_link');
  if (!submission) blocks.push('missing_required_link');
  if (!receipt) warnings.push('receipt_missing');

  if (proof?.startDecision === 'no_start') blocks.push('proof_submission_mismatch');
  if (receipt && submission && receipt.providerSubmissionContractId !== submission.providerSubmissionContractId) blocks.push('submission_receipt_mismatch');

  const strict = policyProfileId === 'production_verified';
  if (strict) {
    if (submission?.submissionSignatureStatus !== 'signed') blocks.push('submission_signature_missing');
    if (receipt?.receiptSignatureStatus !== 'signed') blocks.push('receipt_signature_missing');
    if (!subTrust) blocks.push('submission_trust_publication_missing');
    if (!recTrust) blocks.push('receipt_trust_publication_missing');
  }

  let overallDispatchReadiness = 'ready';
  let dispatchDecision = 'dispatch';
  if (blocks.length) { overallDispatchReadiness = 'blocked'; dispatchDecision = 'do_not_dispatch'; }
  else if (warnings.length) { overallDispatchReadiness = 'ready_with_warnings'; dispatchDecision = 'dispatch_with_warnings'; }
  return { overallDispatchReadiness, dispatchDecision, blockingReasons: [...new Set(blocks)], warnings: [...new Set(warnings)] };
}

async function latestSubmission({ providerType = null } = {}) {
  const list = await listProviderSubmissionContracts({ providerType });
  return list.providerSubmissionContracts?.[0] || null;
}

async function latestReceipt({ providerType = null } = {}) {
  const list = await listExecutionReceipts({ providerType });
  return list.executionReceipts?.[0] || null;
}

async function writeBoard(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.schedulerBoardId), JSON.stringify(row, null, 2), 'utf8');
}

export async function createSchedulerBoard({ renderAdapterContractId = null, providerSubmissionContractId = null, executionReceiptId = null, orchestrationProofCertificateId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  if (mode === 'explicit_refs' && (!providerSubmissionContractId || !orchestrationProofCertificateId)) return { error: 'missing_required_refs_for_explicit_mode' };

  const proof = orchestrationProofCertificateId
    ? (await getOrchestrationProofCertificate(orchestrationProofCertificateId)).orchestrationProofCertificate
    : (await latestOrchestrationProofCertificate({ renderAdapterContractId, policyProfileId, mode: 'latest' })).orchestrationProofCertificate;

  const submission = providerSubmissionContractId
    ? (await getProviderSubmissionContract(providerSubmissionContractId)).providerSubmissionContract
    : await latestSubmission({ providerType: null });

  const receipt = executionReceiptId
    ? (await getExecutionReceipt(executionReceiptId)).executionReceipt
    : await latestReceipt({ providerType: submission?.providerType || null });

  const subTrust = submission ? await getLatestSubmissionTrustPublication(submission.providerSubmissionContractId) : { error: 'submission_trust_publication_not_found' };
  const recTrust = receipt ? await getLatestReceiptTrustPublication(receipt.executionReceiptId) : { error: 'receipt_trust_publication_not_found' };

  const posture = computeDispatch({
    policyProfileId,
    proof,
    submission,
    receipt,
    subTrust: subTrust.error ? null : subTrust.submissionTrustPublication,
    recTrust: recTrust.error ? null : recTrust.receiptTrustPublication
  });

  const board = {
    schedulerBoardId: id(),
    createdAt: new Date().toISOString(),
    boardVersion: 'v1',
    targetRef: {
      renderAdapterContractId: renderAdapterContractId || proof?.renderAdapterContractId || null,
      providerSubmissionContractId: submission?.providerSubmissionContractId || null,
      executionReceiptId: receipt?.executionReceiptId || null,
      orchestrationProofCertificateId: proof?.orchestrationProofCertificateId || null
    },
    policyProfileId,
    orchestrationProofSummary: proof ? {
      orchestrationProofCertificateId: proof.orchestrationProofCertificateId,
      proofDigest: proof.proofDigest,
      startDecision: proof.startDecision,
      overallVerdict: proof.overallVerdict
    } : null,
    providerSubmissionSummary: submission ? {
      providerSubmissionContractId: submission.providerSubmissionContractId,
      payloadDigest: submission.payloadDigest,
      readinessState: submission.readinessState,
      submissionSignatureStatus: submission.submissionSignatureStatus || 'unsigned'
    } : null,
    executionReceiptSummary: receipt ? {
      executionReceiptId: receipt.executionReceiptId,
      receiptDigest: receiptDigest(receipt),
      submissionStatus: receipt.submissionStatus,
      schedulerStatus: receipt.schedulerStatus,
      receiptSignatureStatus: receipt.receiptSignatureStatus || 'unsigned',
      callbackDerivedState: {
        lastCallbackType: receipt.lastCallbackType || null,
        lastCallbackAt: receipt.lastCallbackAt || null,
        callbackTrustStatus: receipt.callbackTrustStatus || 'none',
        callbackCount: Number(receipt.callbackCount || 0),
        replayStatus: receipt.lastCallbackReplayStatus || null,
        keyRegistryStatus: receipt.lastCallbackKeyRegistryStatus || null,
        outcome: receipt.lastCallbackOutcome || null
      },
      externallyAcknowledged: ['acknowledged','closed','rejected'].includes(receipt.submissionStatus),
      replayRiskSummary: ['conflicting_replay','duplicate_within_window'].includes(receipt.lastCallbackReplayStatus) ? 'elevated' : 'normal',
      schedulerPostureWarning: receipt.callbackTrustStatus === 'unsigned' ? 'state_advanced_from_unsigned_callback' : null,
      stateMismatchWarning: receipt.lastCallbackType === 'execution_completed' && receipt.submissionStatus !== 'closed' ? 'provider_completed_but_receipt_not_closed' : null
    } : null,
    submissionTrustPublicationSummary: subTrust.error ? null : {
      submissionTrustPublicationId: subTrust.submissionTrustPublication.submissionTrustPublicationId,
      submissionHeadDigest: subTrust.submissionTrustPublication.submissionHeadDigest,
      submissionHeadDigestVersion: subTrust.submissionTrustPublication.submissionHeadDigestVersion,
      signatureStatus: subTrust.submissionTrustPublication.submissionTrustPublicationSignatureStatus
    },
    receiptTrustPublicationSummary: recTrust.error ? null : {
      receiptTrustPublicationId: recTrust.receiptTrustPublication.receiptTrustPublicationId,
      receiptHeadDigest: recTrust.receiptTrustPublication.receiptHeadDigest,
      receiptHeadDigestVersion: recTrust.receiptTrustPublication.receiptHeadDigestVersion,
      signatureStatus: recTrust.receiptTrustPublication.receiptTrustPublicationSignatureStatus
    },
    overallDispatchReadiness: posture.overallDispatchReadiness,
    dispatchDecision: posture.dispatchDecision,
    blockingReasons: posture.blockingReasons,
    warnings: posture.warnings,
    boardDigest: null,
    boardDigestVersion: 'sha256-v1',
    metadata: { deterministic: true }
  };

  board.boardDigest = crypto.createHash('sha256').update(JSON.stringify(boardDigestInput(board))).digest('hex');
  await writeBoard(board);
  return { schedulerBoard: board };
}

export async function getSchedulerBoard(schedulerBoardId) {
  try { return { schedulerBoard: JSON.parse(await fs.readFile(fileFor(schedulerBoardId), 'utf8')) }; }
  catch { return { error: 'scheduler_board_not_found' }; }
}

export async function latestSchedulerBoard({ renderAdapterContractId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  let latest = null;
  for (const f of files) {
    try {
      const b = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (renderAdapterContractId && b.targetRef?.renderAdapterContractId !== renderAdapterContractId) continue;
      if (policyProfileId && b.policyProfileId !== policyProfileId) continue;
      if (!latest || String(b.createdAt).localeCompare(String(latest.createdAt)) > 0) latest = b;
    } catch {}
  }
  if (latest && mode !== 'latest') return { schedulerBoard: latest };
  return createSchedulerBoard({ renderAdapterContractId, policyProfileId, mode: 'latest' });
}

export function exportSchedulerBoard(board, format = 'json') {
  if (format === 'json' || format === 'scheduler_board') return { contentType: 'application/json', filename: `${board.schedulerBoardId}${format==='scheduler_board'?'-scheduler':''}.json`, content: JSON.stringify(board, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Scheduler Board ${board.schedulerBoardId}`);
  lines.push('', `- Dispatch Decision: ${board.dispatchDecision}`);
  lines.push(`- Dispatch Readiness: ${board.overallDispatchReadiness}`);
  lines.push(`- Board Digest: ${board.boardDigest}`);
  lines.push(`- Blocking: ${(board.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(board.warnings || []).join(', ') || 'none'}`);
  return { contentType: 'text/markdown; charset=utf-8', filename: `${board.schedulerBoardId}.md`, content: `${lines.join('\n')}\n` };
}

export async function verifySchedulerBoard(payloadOrRef = {}) {
  const board = payloadOrRef?.schedulerBoardId ? (await getSchedulerBoard(payloadOrRef.schedulerBoardId)).schedulerBoard : payloadOrRef;
  if (!board || typeof board !== 'object') return { status: 'malformed_board', reasonCodes: ['missing_board'] };
  if (!board.boardDigest) return { status: 'board_digest_mismatch', reasonCodes: ['scheduler_board_digest_missing'] };
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(boardDigestInput(board))).digest('hex');
  if (recomputed !== board.boardDigest) return { status: 'board_digest_mismatch', reasonCodes: ['board_digest_mismatch'], storedBoardDigest: board.boardDigest, recomputedBoardDigest: recomputed };
  if (!board.orchestrationProofSummary || !board.providerSubmissionSummary) return { status: 'missing_required_link', reasonCodes: ['missing_required_link'] };
  if (board.dispatchDecision === 'dispatch' && board.orchestrationProofSummary.startDecision === 'no_start') return { status: 'dispatch_policy_invalid', reasonCodes: ['proof_submission_mismatch'] };
  return { status: 'verified', reasonCodes: ['board_digest_verified','linked_refs_present'], dispatchDecision: board.dispatchDecision, overallDispatchReadiness: board.overallDispatchReadiness, blockingReasons: board.blockingReasons || [], warnings: board.warnings || [] };
}
