import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { getExecutionResultArtifact, listExecutionResultArtifacts } from './executionResultArtifactService.js';
import { getLatestResultTrustPublication, verifyResultTrustPublication } from './resultTrustPublicationService.js';
import { getExecutionReceipt, patchExecutionReceipt } from './executionReceiptService.js';
import { getProviderSubmissionContract } from './providerSubmissionService.js';
import { getOutputPolicyProfile } from './outputPolicyService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/produced-output-verifiers';
const id = () => `pov_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const fileFor = (producedOutputVerifierId) => path.join(ROOT, `${producedOutputVerifierId}.json`);

async function writeRow(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(row.producedOutputVerifierId), JSON.stringify(row, null, 2), 'utf8');
}

function buildAvailability({ artifacts, requiredOutputTypes }) {
  const availableOutputTypes = [...new Set(artifacts.map((a) => a.artifactType))];
  const latestOutputRefs = {};
  for (const a of artifacts) {
    if (a.artifactPayload?.outputRef) latestOutputRefs[a.artifactType] = a.artifactPayload.outputRef;
  }
  const missingRequiredOutputs = requiredOutputTypes.filter((t) => !availableOutputTypes.includes(t));
  const trustQualifiedOutputTypes = [...new Set(artifacts.filter((a) => a.trustMetadata?.artifactOriginStatus === 'trusted').map((a) => a.artifactType))];
  const untrustedOutputTypes = availableOutputTypes.filter((t) => !trustQualifiedOutputTypes.includes(t));
  return { availableOutputTypes, latestOutputRefs, outputCount: artifacts.length, requiredOutputTypes, missingRequiredOutputs, trustQualifiedOutputTypes, untrustedOutputTypes };
}

export async function createProducedOutputVerifier({ executionReceiptId = null, providerSubmissionContractId = null, latestResultArtifactId = null, policyProfileId = 'dev', mode = 'latest' } = {}) {
  if (mode === 'explicit_refs' && !executionReceiptId && !providerSubmissionContractId && !latestResultArtifactId) return { error: 'unsupported_output_verifier_scope' };
  const policy = getOutputPolicyProfile(policyProfileId);

  let artifact = null;
  if (latestResultArtifactId) {
    const got = await getExecutionResultArtifact(latestResultArtifactId);
    if (got.error) return got;
    artifact = got.executionResultArtifact;
  }

  let receipt = null;
  if (executionReceiptId) {
    const got = await getExecutionReceipt(executionReceiptId);
    if (got.error) return got;
    receipt = got.executionReceipt;
  }

  let submission = null;
  if (providerSubmissionContractId) {
    const got = await getProviderSubmissionContract(providerSubmissionContractId);
    if (got.error) return got;
    submission = got.providerSubmissionContract;
  }

  if (!artifact) {
    const list = await listExecutionResultArtifacts({ sourceExecutionReceiptId: receipt?.executionReceiptId || null });
    let rows = list.executionResultArtifacts || [];
    if (providerSubmissionContractId) rows = rows.filter((r) => r.sourceProviderSubmissionContractId === providerSubmissionContractId);
    rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    artifact = rows[0] || null;
  }

  if (!artifact) {
    const row = {
      producedOutputVerifierId: id(), createdAt: new Date().toISOString(), verifierVersion: 'v1',
      targetRef: { executionReceiptId: receipt?.executionReceiptId || executionReceiptId || null, providerSubmissionContractId: submission?.providerSubmissionContractId || providerSubmissionContractId || null, latestResultArtifactId: null, mode },
      providerType: receipt?.providerType || submission?.providerType || null,
      providerProfileId: receipt?.providerProfileId || submission?.providerProfileId || null,
      latestResultArtifactSummary: null,
      resultTrustPublicationSummary: null,
      receiptSummary: receipt ? { executionReceiptId: receipt.executionReceiptId, submissionStatus: receipt.submissionStatus } : null,
      submissionSummary: submission ? { providerSubmissionContractId: submission.providerSubmissionContractId, readinessState: submission.readinessState } : null,
      policyEvaluation: { policyProfileId, requireProducedOutputVerifierPass: policy.requireProducedOutputVerifierPass },
      overallOutputVerdict: 'missing_output',
      blockingReasons: ['missing_latest_output'],
      warnings: [],
      outputAvailabilitySummary: buildAvailability({ artifacts: [], requiredOutputTypes: [] }),
      metadata: { deterministic: true }
    };
    await writeRow(row);
    return { producedOutputVerifier: row };
  }

  if (!receipt && artifact.sourceExecutionReceiptId) {
    const got = await getExecutionReceipt(artifact.sourceExecutionReceiptId);
    if (!got.error) receipt = got.executionReceipt;
  }
  if (!submission && artifact.sourceProviderSubmissionContractId) {
    const got = await getProviderSubmissionContract(artifact.sourceProviderSubmissionContractId);
    if (!got.error) submission = got.providerSubmissionContract;
  }

  const trust = await getLatestResultTrustPublication(artifact.executionResultArtifactId);
  const trustVerify = trust.error ? { status: 'result_trust_publication_missing', reasonCodes: ['result_trust_publication_missing'] } : await verifyResultTrustPublication(artifact.executionResultArtifactId, trust.resultTrustPublication.resultTrustPublicationId);

  const listAll = await listExecutionResultArtifacts({ sourceExecutionReceiptId: artifact.sourceExecutionReceiptId || null });
  const artifacts = (listAll.executionResultArtifacts || []).filter((r) => r.sourceProviderSubmissionContractId === (artifact.sourceProviderSubmissionContractId || r.sourceProviderSubmissionContractId));
  const requiredOutputTypes = policy.requiredOutputTypesByProvider[artifact.providerType] || [];
  const outputAvailabilitySummary = buildAvailability({ artifacts, requiredOutputTypes });

  const blockingReasons = [];
  const warnings = [];

  if (policy.requireSignedResultArtifact && artifact.trustMetadata?.artifactSignatureStatus !== 'signed') blockingReasons.push('result_artifact_signature_missing');
  if (artifact.trustMetadata?.artifactSignatureValid === false) blockingReasons.push('result_artifact_signature_invalid');

  if (policy.requireSignedResultTrustPublication && trust.error) blockingReasons.push('result_trust_publication_missing');
  if (policy.requireSignedResultTrustPublication && !trust.error && trust.resultTrustPublication.resultTrustPublicationSignatureStatus !== 'signed') blockingReasons.push('result_trust_publication_invalid');
  if (!trust.error && trustVerify.status !== 'verified') blockingReasons.push('result_trust_publication_invalid');

  if (outputAvailabilitySummary.missingRequiredOutputs.length) {
    for (const t of outputAvailabilitySummary.missingRequiredOutputs) blockingReasons.push(`missing_required_output_type:${t}`);
  }

  if (outputAvailabilitySummary.untrustedOutputTypes.length) warnings.push('untrusted_output_types_present');

  let overallOutputVerdict = 'verified_output';
  if (!artifacts.length) overallOutputVerdict = 'missing_output';
  else if (blockingReasons.length) {
    if (blockingReasons.includes('result_artifact_signature_invalid')) overallOutputVerdict = 'invalid_result_signature';
    else if (blockingReasons.includes('result_trust_publication_invalid')) overallOutputVerdict = 'invalid_publication_signature';
    else overallOutputVerdict = 'blocked';
  } else if (warnings.length) overallOutputVerdict = 'verified_output_with_warnings';

  const row = {
    producedOutputVerifierId: id(),
    createdAt: new Date().toISOString(),
    verifierVersion: 'v1',
    targetRef: {
      executionReceiptId: receipt?.executionReceiptId || artifact.sourceExecutionReceiptId || null,
      providerSubmissionContractId: submission?.providerSubmissionContractId || artifact.sourceProviderSubmissionContractId || null,
      latestResultArtifactId: artifact.executionResultArtifactId,
      policyProfileId,
      mode
    },
    providerType: artifact.providerType,
    providerProfileId: artifact.providerProfileId,
    latestResultArtifactSummary: {
      executionResultArtifactId: artifact.executionResultArtifactId,
      artifactType: artifact.artifactType,
      artifactDigest: artifact.artifactDigest,
      ingestionStatus: artifact.ingestionStatus,
      trustStatus: artifact.trustMetadata?.artifactOriginStatus || 'unknown_origin',
      signatureStatus: artifact.trustMetadata?.artifactSignatureStatus || 'unsigned'
    },
    resultTrustPublicationSummary: trust.error ? null : {
      resultTrustPublicationId: trust.resultTrustPublication.resultTrustPublicationId,
      resultHeadDigest: trust.resultTrustPublication.resultHeadDigest,
      resultHeadDigestVersion: trust.resultTrustPublication.resultHeadDigestVersion,
      signatureStatus: trust.resultTrustPublication.resultTrustPublicationSignatureStatus
    },
    receiptSummary: receipt ? {
      executionReceiptId: receipt.executionReceiptId,
      submissionStatus: receipt.submissionStatus,
      schedulerStatus: receipt.schedulerStatus
    } : null,
    submissionSummary: submission ? {
      providerSubmissionContractId: submission.providerSubmissionContractId,
      readinessState: submission.readinessState
    } : null,
    policyEvaluation: {
      policyProfileId,
      requireSignedResultArtifact: policy.requireSignedResultArtifact,
      requireSignedResultTrustPublication: policy.requireSignedResultTrustPublication,
      requireProducedOutputVerifierPass: policy.requireProducedOutputVerifierPass,
      requiredOutputTypes
    },
    overallOutputVerdict,
    blockingReasons,
    warnings,
    outputAvailabilitySummary,
    metadata: { deterministic: true }
  };

  await writeRow(row);

  if (row.targetRef.executionReceiptId) {
    await patchExecutionReceipt(row.targetRef.executionReceiptId, {
      action: 'addNote', actorType: 'produced_output_verifier', summary: `produced_output_verifier:${row.overallOutputVerdict}`,
      metadata: { producedOutputVerifierId: row.producedOutputVerifierId },
      outputVerifierUpdate: {
        latestProducedOutputVerdict: row.overallOutputVerdict,
        outputAvailabilitySummary: row.outputAvailabilitySummary
      }
    });
  }

  return { producedOutputVerifier: row };
}

export async function getProducedOutputVerifier(producedOutputVerifierId) {
  try { return { producedOutputVerifier: JSON.parse(await fs.readFile(fileFor(producedOutputVerifierId), 'utf8')) }; }
  catch { return { error: 'produced_output_verifier_not_found' }; }
}

export async function latestProducedOutputVerifier({ executionReceiptId = null, providerSubmissionContractId = null, policyProfileId = 'dev' } = {}) {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  let latest = null;
  for (const f of files) {
    try {
      const row = JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
      if (executionReceiptId && row.targetRef?.executionReceiptId !== executionReceiptId) continue;
      if (providerSubmissionContractId && row.targetRef?.providerSubmissionContractId !== providerSubmissionContractId) continue;
      if (policyProfileId && row.targetRef?.policyProfileId !== policyProfileId) continue;
      if (!latest || String(row.createdAt).localeCompare(String(latest.createdAt)) > 0) latest = row;
    } catch {}
  }
  if (!latest) return createProducedOutputVerifier({ executionReceiptId, providerSubmissionContractId, policyProfileId, mode: 'latest' });
  return { producedOutputVerifier: latest };
}

export function exportProducedOutputVerifier(row, format = 'json') {
  if (format === 'json') return { contentType: 'application/json', filename: `${row.producedOutputVerifierId}.json`, content: JSON.stringify(row, null, 2) };
  if (format === 'output_verdict') {
    const payload = {
      producedOutputVerifierId: row.producedOutputVerifierId,
      createdAt: row.createdAt,
      targetRef: row.targetRef,
      overallOutputVerdict: row.overallOutputVerdict,
      blockingReasons: row.blockingReasons || [],
      warnings: row.warnings || [],
      outputAvailabilitySummary: row.outputAvailabilitySummary,
      latestResultHeadDigest: row.resultTrustPublicationSummary?.resultHeadDigest || null
    };
    return { contentType: 'application/json', filename: `${row.producedOutputVerifierId}-output-verdict.json`, content: JSON.stringify(payload, null, 2) };
  }
  if (format !== 'markdown') return { error: 'malformed_output_verdict_export' };
  const lines = [
    `# Produced Output Verifier ${row.producedOutputVerifierId}`,
    '',
    `- Verdict: ${row.overallOutputVerdict}`,
    `- Provider: ${row.providerType}/${row.providerProfileId}`,
    `- Result Artifact: ${row.latestResultArtifactSummary?.executionResultArtifactId || 'none'}`,
    `- Result Head Digest: ${row.resultTrustPublicationSummary?.resultHeadDigest || 'none'}`,
    `- Blocking: ${(row.blockingReasons || []).join(', ') || 'none'}`,
    `- Warnings: ${(row.warnings || []).join(', ') || 'none'}`
  ];
  return { contentType: 'text/markdown; charset=utf-8', filename: `${row.producedOutputVerifierId}.md`, content: `${lines.join('\n')}\n` };
}
