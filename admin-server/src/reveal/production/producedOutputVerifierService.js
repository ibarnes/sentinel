import { getExecutionResultArtifact, listExecutionResultArtifacts } from './executionResultArtifactService.js';
import { getLatestResultTrustPublication, verifyResultTrustPublication } from './resultTrustPublicationService.js';

export async function verifyProducedOutputSurface({ executionResultArtifactId = null, sourceExecutionReceiptId = null, sourceProviderSubmissionContractId = null } = {}) {
  let artifact = null;
  if (executionResultArtifactId) {
    const got = await getExecutionResultArtifact(executionResultArtifactId);
    if (got.error) return got;
    artifact = got.executionResultArtifact;
  } else {
    const list = await listExecutionResultArtifacts({ sourceExecutionReceiptId: sourceExecutionReceiptId || null });
    const filtered = (list.executionResultArtifacts || []).filter((r) => !sourceProviderSubmissionContractId || r.sourceProviderSubmissionContractId === sourceProviderSubmissionContractId);
    filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    artifact = filtered[0] || null;
    if (!artifact) return { error: 'execution_result_artifact_not_found' };
  }

  const trust = await getLatestResultTrustPublication(artifact.executionResultArtifactId);
  const trustVerify = trust.error ? { status: 'missing_result_trust_publication', reasonCodes: ['result_trust_publication_missing'] } : await verifyResultTrustPublication(artifact.executionResultArtifactId, trust.resultTrustPublication.resultTrustPublicationId);

  return {
    producedOutputVerifier: {
      executionResultArtifactId: artifact.executionResultArtifactId,
      providerType: artifact.providerType,
      providerProfileId: artifact.providerProfileId,
      sourceExecutionReceiptId: artifact.sourceExecutionReceiptId,
      sourceProviderSubmissionContractId: artifact.sourceProviderSubmissionContractId,
      artifactType: artifact.artifactType,
      artifactDigest: artifact.artifactDigest,
      ingestionStatus: artifact.ingestionStatus,
      trustStatus: artifact.trustMetadata?.artifactOriginStatus || 'unknown_origin',
      latestResultHeadDigest: trust.error ? null : trust.resultTrustPublication.resultHeadDigest,
      latestResultHeadDigestVersion: trust.error ? null : trust.resultTrustPublication.resultHeadDigestVersion,
      resultTrustPublicationId: trust.error ? null : trust.resultTrustPublication.resultTrustPublicationId,
      resultTrustVerificationStatus: trustVerify.status,
      reasonCodes: trustVerify.reasonCodes || []
    }
  };
}
