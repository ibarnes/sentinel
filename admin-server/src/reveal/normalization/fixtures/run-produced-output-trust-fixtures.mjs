import assert from 'assert';
import { listExecutionResultArtifacts } from '../../production/executionResultArtifactService.js';
import { publishResultTrust, getLatestResultTrustPublication, verifyResultTrustPublication } from '../../production/resultTrustPublicationService.js';
import { createProducedOutputVerifier } from '../../production/producedOutputVerifierService.js';
import { buildOutputComplianceSurface } from '../../production/outputComplianceService.js';

(async () => {
  const list = await listExecutionResultArtifacts({});
  const artifact = (list.executionResultArtifacts || [])[0];
  if (!artifact) throw new Error('fixture_requires_execution_result_artifact');

  const pub = await publishResultTrust(artifact.executionResultArtifactId);
  assert.ok(pub.resultTrustPublication?.resultHeadDigest);

  const latest = await getLatestResultTrustPublication(artifact.executionResultArtifactId);
  assert.equal(latest.resultTrustPublication.resultTrustPublicationId, pub.resultTrustPublication.resultTrustPublicationId);

  const verify = await verifyResultTrustPublication(artifact.executionResultArtifactId);
  assert.equal(verify.status, 'verified');

  const surface = await createProducedOutputVerifier({ latestResultArtifactId: artifact.executionResultArtifactId, mode: 'explicit_refs', policyProfileId: 'internal_verified' });
  assert.ok(surface.producedOutputVerifier.resultTrustPublicationSummary?.resultHeadDigest || surface.producedOutputVerifier.overallOutputVerdict);

  if (artifact.sourceExecutionReceiptId) {
    const compliance = await buildOutputComplianceSurface({ executionReceiptId: artifact.sourceExecutionReceiptId });
    assert.ok(['ready','incomplete'].includes(compliance.outputCompliance.complianceStatus));
  }

  console.log('produced-output-trust-fixtures: ok');
})();
