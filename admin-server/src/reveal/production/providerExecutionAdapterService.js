import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getProviderSubmissionContract, listProviderSubmissionContracts } from './providerSubmissionService.js';
import { getRenderAdapterContract } from './renderAdapterContractService.js';
import { listExecutionReceipts } from './executionReceiptService.js';
import { latestSchedulerBoard } from './schedulerBoardService.js';
import { mapSubmissionToProviderExecution } from './providerExecutionMappingService.js';
import { executionPayloadDigest } from './providerExecutionPayloadService.js';
import { validateProviderExecutionPayload } from './providerExecutionValidationService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/provider-execution-adapters';
const id = () => `pea_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (providerExecutionAdapterId) => path.join(ROOT, `${providerExecutionAdapterId}.json`);

async function writeRow(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.providerExecutionAdapterId), JSON.stringify(row, null, 2), 'utf8');
}

export async function getProviderExecutionAdapter(providerExecutionAdapterId) {
  try { return { providerExecutionAdapter: JSON.parse(await fs.readFile(fileFor(providerExecutionAdapterId), 'utf8')) }; }
  catch { return { error: 'provider_execution_adapter_not_found' }; }
}

async function latestSubmission() {
  const list = await listProviderSubmissionContracts({});
  return list.providerSubmissionContracts?.[0] || null;
}

export async function createProviderExecutionAdapter({ providerSubmissionContractId = null, providerType = null, providerProfileId = 'default', policyProfileId = null, mode = 'latest' } = {}) {
  if (!providerSubmissionContractId && mode === 'explicit_refs') return { error: 'missing_provider_submission_contract_id' };

  const submission = providerSubmissionContractId
    ? (await getProviderSubmissionContract(providerSubmissionContractId)).providerSubmissionContract
    : await latestSubmission();
  if (!submission) return { error: 'provider_submission_contract_not_found' };

  const renderAdapterContractId = submission.submissionPayload?.manifestRef?.sourceRenderAdapterContractId || null;
  const rac = renderAdapterContractId ? await getRenderAdapterContract(renderAdapterContractId) : { error: 'render_adapter_contract_not_found' };

  const receipts = await listExecutionReceipts({});
  const receipt = (receipts.executionReceipts || []).find((r) => r.providerSubmissionContractId === submission.providerSubmissionContractId) || null;
  const sched = await latestSchedulerBoard({ renderAdapterContractId, policyProfileId: policyProfileId || submission.submissionPayload?.orchestrationProfile || 'dev', mode: 'latest' });

  const mapped = mapSubmissionToProviderExecution({
    submission,
    providerType: providerType || submission.providerType,
    providerProfileId,
    receipt,
    schedulerBoard: sched.schedulerBoard || null
  });
  if (mapped.error) return mapped;

  const validation = validateProviderExecutionPayload(mapped.providerExecutionPayload);
  const blockingReasons = [...new Set([...(mapped.blockingReasons || []), ...((validation.status === 'valid' || validation.status === 'valid_with_warnings') ? [] : (validation.reasonCodes || []))])];
  const warnings = [...new Set([...(mapped.warnings || []), ...(validation.status === 'valid_with_warnings' ? (validation.reasonCodes || []) : [])])];

  let readinessState = 'ready';
  if (blockingReasons.includes('unsupported_output_target')) readinessState = 'unsupported_output_target';
  else if (blockingReasons.includes('unsupported_stage_type')) readinessState = 'unsupported_stage_type';
  else if (blockingReasons.includes('missing_required_input')) readinessState = 'missing_required_input';
  else if (blockingReasons.length) readinessState = 'blocked';
  else if (warnings.length) readinessState = 'ready_with_warnings';

  const row = {
    providerExecutionAdapterId: id(),
    createdAt: new Date().toISOString(),
    adapterVersion: 'v1',
    providerType: mapped.providerProfile.providerType,
    providerProfileId: mapped.providerProfile.providerProfileId,
    sourceProviderSubmissionContractId: submission.providerSubmissionContractId,
    sourceRenderAdapterContractId: renderAdapterContractId,
    sourceRefs: {
      providerSubmissionContractId: submission.providerSubmissionContractId,
      renderAdapterContractId,
      executionReceiptId: receipt?.executionReceiptId || null,
      schedulerBoardId: sched.schedulerBoard?.schedulerBoardId || null,
      schedulerBoardDigest: sched.schedulerBoard?.boardDigest || null
    },
    readinessState,
    providerExecutionPayload: mapped.providerExecutionPayload,
    providerExecutionPayloadDigest: executionPayloadDigest(mapped.providerExecutionPayload),
    capabilityMappingSummary: mapped.capabilityMappingSummary,
    policyEvaluation: {
      orchestrationProfile: policyProfileId || submission.submissionPayload?.orchestrationProfile || null,
      submissionMode: submission.submissionMode,
      submissionSignatureStatus: submission.submissionSignatureStatus || 'unsigned',
      receiptSignatureStatus: receipt?.receiptSignatureStatus || null,
      schedulerBoardDecision: sched.schedulerBoard?.dispatchDecision || null,
      sourceReadinessState: submission.readinessState
    },
    blockingReasons,
    warnings,
    metadata: {
      deterministic: true,
      sourceRenderAdapterContractFound: !rac.error
    }
  };

  await writeRow(row);
  return { providerExecutionAdapter: row };
}

export function exportProviderExecutionAdapter(row, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${row.providerExecutionAdapterId}.json`, content: JSON.stringify(row, null, 2) };
  if (format === 'provider_execution_payload') return { contentType: 'application/json', filename: `${row.providerExecutionAdapterId}-provider-execution-payload.json`, content: JSON.stringify(row.providerExecutionPayload, null, 2) };
  if (format !== 'markdown') return { error: 'invalid_export_format' };
  const lines = [];
  lines.push(`# Provider Execution Adapter ${row.providerExecutionAdapterId}`);
  lines.push('', `- Provider: ${row.providerType}/${row.providerProfileId}`);
  lines.push(`- Submission: ${row.sourceProviderSubmissionContractId}`);
  lines.push(`- Readiness: ${row.readinessState}`);
  lines.push(`- Payload Digest: ${row.providerExecutionPayloadDigest}`);
  lines.push(`- Blocking: ${(row.blockingReasons || []).join(', ') || 'none'}`);
  lines.push(`- Warnings: ${(row.warnings || []).join(', ') || 'none'}`);
  return { contentType: 'text/markdown; charset=utf-8', filename: `${row.providerExecutionAdapterId}.md`, content: `${lines.join('\n')}\n` };
}

export async function validateProviderExecutionAdapter({ providerExecutionAdapterId = null, providerExecutionPayload = null } = {}) {
  let payload = providerExecutionPayload;
  if (!payload && providerExecutionAdapterId) {
    const got = await getProviderExecutionAdapter(providerExecutionAdapterId);
    if (got.error) return got;
    payload = got.providerExecutionAdapter.providerExecutionPayload;
  }
  return validateProviderExecutionPayload(payload);
}
