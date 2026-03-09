import { listExecutionReceipts } from './executionReceiptService.js';
import { applyCallbackToReceipt } from './receiptUpdateAdapterService.js';

export async function reconcileExecutionCallback(callback) {
  let targetExecutionReceiptId = callback.targetExecutionReceiptId || null;
  if (!targetExecutionReceiptId && callback.targetProviderSubmissionContractId) {
    const listed = await listExecutionReceipts({});
    const hit = (listed.executionReceipts || []).find((r) => r.providerSubmissionContractId === callback.targetProviderSubmissionContractId);
    if (hit) targetExecutionReceiptId = hit.executionReceiptId;
  }

  if (!targetExecutionReceiptId) {
    return {
      reconciliationStatus: 'target_not_found',
      targetExecutionReceiptId: null,
      targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId || null,
      lifecycleEventId: null,
      stateBefore: null,
      stateAfter: null,
      reasonCodes: ['missing_target_refs'],
      warnings: callback.warnings || [],
      verifiedTrustStatus: callback.trustMetadata?.callbackOriginStatus || 'unknown_origin'
    };
  }

  const applied = await applyCallbackToReceipt({ executionReceiptId: targetExecutionReceiptId, callback });
  return {
    reconciliationStatus: applied.reconciliationStatus,
    targetExecutionReceiptId: applied.targetExecutionReceiptId || targetExecutionReceiptId,
    targetProviderSubmissionContractId: applied.targetProviderSubmissionContractId || callback.targetProviderSubmissionContractId || null,
    lifecycleEventId: applied.lifecycleEventId || null,
    stateBefore: applied.stateBefore || null,
    stateAfter: applied.stateAfter || null,
    reasonCodes: applied.reasonCodes || [],
    warnings: [...new Set([...(callback.warnings || []), ...(applied.warnings || [])])],
    verifiedTrustStatus: callback.trustMetadata?.callbackOriginStatus || 'unknown_origin'
  };
}
