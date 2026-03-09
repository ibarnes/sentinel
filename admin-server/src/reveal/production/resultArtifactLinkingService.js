import { getExecutionReceipt, listExecutionReceipts, patchExecutionReceipt } from './executionReceiptService.js';

export async function linkResultArtifactToReceipt(artifact) {
  let targetExecutionReceiptId = artifact.sourceExecutionReceiptId || null;
  let targetProviderSubmissionContractId = artifact.sourceProviderSubmissionContractId || null;

  if (!targetExecutionReceiptId) {
    const list = await listExecutionReceipts({});
    const hit = (list.executionReceipts || []).find((r) => {
      if (targetProviderSubmissionContractId && r.providerSubmissionContractId === targetProviderSubmissionContractId) return true;
      if (artifact.sourceExternalExecutionRef && r.externalExecutionRef === artifact.sourceExternalExecutionRef) return true;
      return false;
    });
    if (hit) {
      targetExecutionReceiptId = hit.executionReceiptId;
      targetProviderSubmissionContractId = hit.providerSubmissionContractId;
    }
  }

  if (!targetExecutionReceiptId) {
    return {
      ingestionStatus: 'target_not_found',
      targetExecutionReceiptId: null,
      targetProviderSubmissionContractId: targetProviderSubmissionContractId || null,
      lifecycleEventId: null,
      artifactLinkSummary: { linked: false, reason: 'missing_target_refs' },
      reasonCodes: ['missing_target_refs']
    };
  }

  const got = await getExecutionReceipt(targetExecutionReceiptId);
  if (got.error) {
    return {
      ingestionStatus: 'target_not_found',
      targetExecutionReceiptId,
      targetProviderSubmissionContractId: targetProviderSubmissionContractId || null,
      lifecycleEventId: null,
      artifactLinkSummary: { linked: false, reason: 'execution_receipt_not_found' },
      reasonCodes: ['execution_receipt_not_found']
    };
  }

  const receipt = got.executionReceipt;
  if (receipt.providerType !== artifact.providerType || receipt.providerProfileId !== artifact.providerProfileId) {
    return {
      ingestionStatus: 'blocked',
      targetExecutionReceiptId,
      targetProviderSubmissionContractId: receipt.providerSubmissionContractId,
      lifecycleEventId: null,
      artifactLinkSummary: { linked: false, reason: 'provider_profile_mismatch' },
      reasonCodes: ['provider_profile_mismatch']
    };
  }

  if (artifact.sourceExternalExecutionRef && receipt.externalExecutionRef && artifact.sourceExternalExecutionRef !== receipt.externalExecutionRef) {
    return {
      ingestionStatus: 'blocked',
      targetExecutionReceiptId,
      targetProviderSubmissionContractId: receipt.providerSubmissionContractId,
      lifecycleEventId: null,
      artifactLinkSummary: { linked: false, reason: 'conflicting_external_execution_ref' },
      reasonCodes: ['conflicting_external_execution_ref']
    };
  }

  const updated = await patchExecutionReceipt(targetExecutionReceiptId, {
    action: 'addNote',
    actorType: 'result_artifact_ingest',
    summary: `result_artifact_ingested:${artifact.artifactType}`,
    metadata: {
      executionResultArtifactId: artifact.executionResultArtifactId,
      artifactType: artifact.artifactType,
      artifactDigest: artifact.artifactDigest
    },
    resultArtifactUpdate: {
      latestResultArtifactId: artifact.executionResultArtifactId,
      latestResultArtifactType: artifact.artifactType,
      latestResultArtifactAt: artifact.createdAt,
      resultArtifactTrustStatus: artifact.trustMetadata?.artifactOriginStatus || 'unknown_origin',
      incrementIngestedArtifactCount: 1,
      availableOutputTypesAppend: [artifact.artifactType],
      resultArtifactWarningsSummary: artifact.warnings || []
    }
  });

  const lifecycleEventId = updated.executionReceipt?.lifecycleEvents?.[updated.executionReceipt.lifecycleEvents.length - 1]?.eventId || null;
  return {
    ingestionStatus: 'applied',
    targetExecutionReceiptId,
    targetProviderSubmissionContractId: receipt.providerSubmissionContractId,
    lifecycleEventId,
    artifactLinkSummary: {
      linked: true,
      availableOutputTypes: updated.executionReceipt?.availableOutputTypes || [],
      ingestedArtifactCount: updated.executionReceipt?.ingestedArtifactCount || 0
    },
    reasonCodes: ['artifact_linked_to_receipt']
  };
}
