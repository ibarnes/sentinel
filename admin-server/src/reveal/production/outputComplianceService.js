import { getExecutionReceipt } from './executionReceiptService.js';
import { listExecutionResultArtifacts } from './executionResultArtifactService.js';

export async function buildOutputComplianceSurface({ executionReceiptId }) {
  const receipt = await getExecutionReceipt(executionReceiptId);
  if (receipt.error) return receipt;
  const r = receipt.executionReceipt;
  const listed = await listExecutionResultArtifacts({ sourceExecutionReceiptId: executionReceiptId });
  const artifacts = listed.executionResultArtifacts || [];

  const expected = Number(r.requestSummary?.artifactCounts?.outputs || 0);
  const produced = Number(r.ingestedArtifactCount || 0);
  const missing = Math.max(0, expected - produced);

  return {
    outputCompliance: {
      executionReceiptId,
      providerType: r.providerType,
      providerProfileId: r.providerProfileId,
      expectedOutputTargets: expected,
      producedArtifactCount: produced,
      missingOutputTargets: missing,
      availableOutputTypes: r.availableOutputTypes || [],
      latestResultArtifactId: r.latestResultArtifactId || null,
      latestResultArtifactType: r.latestResultArtifactType || null,
      latestResultArtifactAt: r.latestResultArtifactAt || null,
      latestResultTrustPublicationId: r.latestResultTrustPublicationId || null,
      latestResultHeadDigest: r.latestResultHeadDigest || null,
      latestProducedOutputVerdict: r.latestProducedOutputVerdict || null,
      resultArtifactTrustStatus: r.resultArtifactTrustStatus || 'none',
      complianceStatus: missing === 0 ? 'ready' : 'incomplete',
      warnings: [
        ...(missing > 0 ? ['expected_outputs_missing'] : []),
        ...(r.resultArtifactTrustStatus === 'unsigned' ? ['unsigned_result_artifact_flow'] : [])
      ],
      artifacts: artifacts.map((a) => ({
        executionResultArtifactId: a.executionResultArtifactId,
        artifactType: a.artifactType,
        artifactDigest: a.artifactDigest,
        ingestionStatus: a.ingestionStatus,
        trustStatus: a.trustMetadata?.artifactOriginStatus || 'unknown_origin',
        createdAt: a.createdAt
      }))
    }
  };
}
