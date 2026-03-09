import assert from 'assert';
import crypto from 'crypto';
import { listProviderSubmissionContracts } from '../../production/providerSubmissionService.js';
import { createExecutionReceipt, getExecutionReceipt } from '../../production/executionReceiptService.js';
import { createExecutionResultArtifact, exportExecutionResultArtifact } from '../../production/executionResultArtifactService.js';
import { verifyResultArtifact } from '../../production/resultArtifactVerificationService.js';
import { publishResultTrust, verifyResultTrustPublication, getLatestResultTrustPublication } from '../../production/resultTrustPublicationService.js';
import { createProducedOutputVerifier, exportProducedOutputVerifier } from '../../production/producedOutputVerifierService.js';

function canon(v) { if (v === null || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(canon); const o = {}; for (const k of Object.keys(v).sort()) o[k] = canon(v[k]); return o; }
function sign(payload, secret) { return crypto.createHmac('sha256', secret).update(JSON.stringify(canon(payload))).digest('hex'); }

async function seed() {
  const list = await listProviderSubmissionContracts({ providerType: 'generic_renderer' });
  const sub = list.providerSubmissionContracts?.[0];
  if (!sub) throw new Error('fixture_requires_provider_submission');
  const rec = await createExecutionReceipt({ providerSubmissionContractId: sub.providerSubmissionContractId });
  if (rec.error) throw new Error(rec.error);
  return { sub, rec: rec.executionReceipt };
}

(async () => {
  const { sub, rec } = await seed();

  const subtitle = await createExecutionResultArtifact({
    providerType: 'generic_renderer', providerProfileId: 'default', artifactType: 'subtitle_output',
    artifactPayload: { format: 'srt', outputRef: 's3://x/sub.srt', durationMs: 12345 },
    sourceExecutionReceiptId: rec.executionReceiptId, sourceProviderSubmissionContractId: sub.providerSubmissionContractId,
    trustMetadata: { unsignedAllowed: true }
  });
  assert.equal(subtitle.ingestionResult.ingestionStatus, 'applied');

  const summaryPayload = { status: 'completed', completedAt: new Date().toISOString(), outputCount: 2, message: 'done' };
  const summarySig = sign(summaryPayload, 'generic-renderer-secret-v1');
  const summary = await createExecutionResultArtifact({
    providerType: 'generic_renderer', providerProfileId: 'default', artifactType: 'execution_result_summary',
    artifactPayload: summaryPayload,
    sourceExecutionReceiptId: rec.executionReceiptId,
    sourceProviderSubmissionContractId: sub.providerSubmissionContractId,
    trustMetadata: { artifactSigningKeyId: 'cbk_generic_default_v1', artifactSignature: summarySig, artifactSigningAlgorithm: 'HMAC-SHA256' }
  });
  assert.equal(summary.ingestionResult.ingestionStatus, 'applied');

  const manifestPayload = { manifestDigest: 'abc123', outputRefs: ['s3://x/a.mp4'], contentSummary: 'render manifest' };
  const manifest = await createExecutionResultArtifact({
    providerType: 'generic_renderer', providerProfileId: 'default', artifactType: 'render_manifest_output',
    artifactPayload: manifestPayload,
    sourceExecutionReceiptId: rec.executionReceiptId,
    sourceProviderSubmissionContractId: sub.providerSubmissionContractId,
    trustMetadata: { unsignedAllowed: true }
  });
  assert.equal(manifest.ingestionResult.ingestionStatus, 'applied');

  const malformed = await createExecutionResultArtifact({
    providerType: 'generic_renderer', providerProfileId: 'default', artifactType: 'subtitle_output',
    artifactPayload: { format: 'srt' }, sourceExecutionReceiptId: rec.executionReceiptId, trustMetadata: { unsignedAllowed: true }
  });
  assert.equal(malformed.error, 'malformed_artifact');

  const invalidSig = await verifyResultArtifact({
    providerType: 'generic_renderer', providerProfileId: 'default', artifactType: 'execution_result_summary',
    artifactPayload: summaryPayload,
    trustMetadata: { artifactSigningKeyId: 'cbk_generic_default_v1', artifactSignature: 'deadbeef', artifactSigningAlgorithm: 'HMAC-SHA256' },
    policyProfile: 'production_verified'
  });
  assert.equal(invalidSig.status, 'invalid_signature');

  const notFound = await createExecutionResultArtifact({
    providerType: 'generic_renderer', providerProfileId: 'default', artifactType: 'execution_result_summary',
    artifactPayload: summaryPayload, sourceExecutionReceiptId: 'erc_missing', trustMetadata: { unsignedAllowed: true }
  });
  assert.equal(notFound.ingestionResult.ingestionStatus, 'target_not_found');

  const mismatch = await createExecutionResultArtifact({
    providerType: 'subtitle_compositor', providerProfileId: 'default', artifactType: 'execution_result_summary',
    artifactPayload: summaryPayload, sourceExecutionReceiptId: rec.executionReceiptId, trustMetadata: { unsignedAllowed: true }
  });
  assert.equal(mismatch.ingestionResult.ingestionStatus, 'blocked');

  const trustPub = await publishResultTrust(summary.executionResultArtifact.executionResultArtifactId);
  assert.ok(trustPub.resultTrustPublication.resultHeadDigest);
  const trustVerify = await verifyResultTrustPublication(summary.executionResultArtifact.executionResultArtifactId);
  assert.equal(trustVerify.status, 'verified');

  const trustPub2 = await publishResultTrust(summary.executionResultArtifact.executionResultArtifactId);
  assert.equal(trustPub2.resultTrustPublication.latestResultArtifactDigest, trustPub.resultTrustPublication.latestResultArtifactDigest);
  assert.ok(trustPub2.resultTrustPublication.previousPublishedResultHeadDigest);

  const latestPub = await getLatestResultTrustPublication(summary.executionResultArtifact.executionResultArtifactId);
  assert.equal(latestPub.resultTrustPublication.resultTrustPublicationId, trustPub2.resultTrustPublication.resultTrustPublicationId);

  const verifierLatest = await createProducedOutputVerifier({ executionReceiptId: rec.executionReceiptId, policyProfileId: 'internal_verified', mode: 'latest' });
  assert.ok(['verified_output','verified_output_with_warnings','blocked','invalid_publication_signature','invalid_result_signature','missing_output'].includes(verifierLatest.producedOutputVerifier.overallOutputVerdict));

  const strictMissing = await createProducedOutputVerifier({ executionReceiptId: rec.executionReceiptId, latestResultArtifactId: subtitle.executionResultArtifact.executionResultArtifactId, policyProfileId: 'production_verified', mode: 'explicit_refs' });
  assert.ok(['blocked','invalid_publication_signature','missing_output'].includes(strictMissing.producedOutputVerifier.overallOutputVerdict));

  const expVerdict = exportProducedOutputVerifier(verifierLatest.producedOutputVerifier, 'output_verdict');
  const parsedVerdict = JSON.parse(expVerdict.content);
  assert.ok(parsedVerdict.overallOutputVerdict);
  assert.ok(parsedVerdict.outputAvailabilitySummary);

  const updatedReceipt = await getExecutionReceipt(rec.executionReceiptId);
  assert.ok(Number(updatedReceipt.executionReceipt.ingestedArtifactCount || 0) >= 3);
  assert.ok(updatedReceipt.executionReceipt.latestResultTrustPublicationId);

  const exp = exportExecutionResultArtifact(summary.executionResultArtifact, 'markdown');
  assert.ok(String(exp.content).includes('# Execution Result Artifact'));

  console.log('execution-result-fixtures: ok');
})();
