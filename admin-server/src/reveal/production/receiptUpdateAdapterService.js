import { getExecutionReceipt, patchExecutionReceipt } from './executionReceiptService.js';

export async function applyCallbackToReceipt({ executionReceiptId, callback }) {
  const got = await getExecutionReceipt(executionReceiptId);
  if (got.error) return { reconciliationStatus: 'target_not_found', reasonCodes: ['execution_receipt_not_found'] };
  const receipt = got.executionReceipt;
  const stateBefore = receipt.submissionStatus;

  if (callback.externalExecutionRef && receipt.externalExecutionRef && receipt.externalExecutionRef !== callback.externalExecutionRef) {
    return { reconciliationStatus: 'policy_blocked', stateBefore, stateAfter: stateBefore, reasonCodes: ['conflicting_external_execution_ref'] };
  }

  const map = {
    handoff_acknowledged: ['markDispatchReady', 'recordHandoff'],
    provider_acknowledged: ['recordAcknowledgement'],
    execution_started: ['addNote'],
    execution_progress: ['addNote'],
    execution_completed: ['closeSuccess'],
    execution_failed: ['closeFailure'],
    execution_rejected: ['recordRejection'],
    execution_canceled: ['cancel'],
    execution_expired: ['expire'],
    provider_note: ['addNote']
  };

  const actions = map[callback.callbackType] || [];
  if (!actions.length) return { reconciliationStatus: 'policy_blocked', stateBefore, stateAfter: stateBefore, reasonCodes: ['unsupported_callback_type'] };

  let current = receipt;
  let lifecycleEventId = null;
  const warnings = [];
  for (const action of actions) {
    const out = await patchExecutionReceipt(current.executionReceiptId, {
      action,
      actorType: 'provider_callback',
      summary: `${callback.callbackType}`,
      externalExecutionRef: callback.externalExecutionRef || null,
      providerMessage: callback.callbackPayload?.message || null,
      providerResult: callback.callbackPayload?.result || null,
      metadata: {
        callbackId: callback.executionCallbackId,
        callbackType: callback.callbackType,
        callbackOriginStatus: callback.trustMetadata?.callbackOriginStatus || 'unknown_origin'
      },
      callbackUpdate: {
        lastCallbackId: callback.executionCallbackId,
        lastCallbackType: callback.callbackType,
        lastCallbackAt: callback.createdAt,
        callbackTrustStatus: callback.trustMetadata?.callbackOriginStatus || 'unknown_origin',
        incrementCallbackCount: action === actions[actions.length - 1] ? 1 : 0,
        callbackWarningsSummary: callback.warnings || []
      }
    });
    if (out.error === 'illegal_status_transition') {
      if (action === 'addNote') continue;
      return { reconciliationStatus: 'blocked', stateBefore, stateAfter: current.submissionStatus, reasonCodes: ['illegal_receipt_transition'], warnings, currentStatus: current.submissionStatus };
    }
    if (out.error) return { reconciliationStatus: 'blocked', stateBefore, stateAfter: current.submissionStatus, reasonCodes: [out.error], warnings };
    current = out.executionReceipt;
    lifecycleEventId = current.lifecycleEvents?.[current.lifecycleEvents.length - 1]?.eventId || lifecycleEventId;
  }

  return {
    reconciliationStatus: 'applied',
    targetExecutionReceiptId: current.executionReceiptId,
    targetProviderSubmissionContractId: current.providerSubmissionContractId,
    lifecycleEventId,
    stateBefore,
    stateAfter: current.submissionStatus,
    warnings,
    reasonCodes: ['callback_applied'],
    executionReceipt: current
  };
}
