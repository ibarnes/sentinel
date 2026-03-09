import assert from 'assert';
import crypto from 'crypto';
import { verifyExecutionCallback } from '../../production/callbackVerificationService.js';
import { createExecutionCallback, exportExecutionCallback, replayCheckExecutionCallback } from '../../production/executionCallbackService.js';
import { listProviderSubmissionContracts } from '../../production/providerSubmissionService.js';
import { createExecutionReceipt, getExecutionReceipt } from '../../production/executionReceiptService.js';

function canon(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canon);
  const out = {};
  for (const k of Object.keys(v).sort()) out[k] = canon(v[k]);
  return out;
}

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(canon(payload))).digest('hex');
}

async function seed() {
  const list = await listProviderSubmissionContracts({});
  const submission = list.providerSubmissionContracts?.[0];
  if (!submission) throw new Error('fixture_requires_existing_provider_submission_contract');
  const receipt = await createExecutionReceipt({ providerSubmissionContractId: submission.providerSubmissionContractId });
  if (receipt.error) throw new Error(receipt.error);
  return { submission, receipt: receipt.executionReceipt };
}

(async () => {
  const payloadAck = { status: 'accepted', eventAt: new Date().toISOString(), externalExecutionRef: 'job-fixture-1' };
  const signedAck = sign(payloadAck, 'generic-renderer-secret-v1');
  const verifyOk = await verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: payloadAck, callbackPolicyProfile: 'internal_verified', trustMetadata: { callbackSigningKeyId: 'cbk_generic_default_v1', callbackSignature: signedAck, callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(verifyOk.status, 'valid');

  const missingField = await verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'execution_completed', callbackPayload: { status: 'completed', eventAt: new Date().toISOString() }, callbackPolicyProfile: 'dev', trustMetadata: { unsignedAllowed: true } });
  assert.equal(missingField.status, 'malformed_callback');

  const unknownKey = await verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: payloadAck, callbackPolicyProfile: 'internal_verified', trustMetadata: { callbackSigningKeyId: 'cbk_unknown', callbackSignature: signedAck, callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(unknownKey.status, 'capability_mismatch');

  const revokedKey = await verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: payloadAck, callbackPolicyProfile: 'production_verified', trustMetadata: { callbackSigningKeyId: 'cbk_generic_revoked_vx', callbackSignature: sign(payloadAck, 'revoked-secret'), callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(revokedKey.status, 'capability_mismatch');

  const retiredKeyDev = await verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: payloadAck, callbackPolicyProfile: 'dev', trustMetadata: { callbackSigningKeyId: 'cbk_generic_retired_v0', callbackSignature: sign(payloadAck, 'generic-renderer-secret-old'), callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(retiredKeyDev.status, 'valid');

  const seeded = await seed();

  const handoff = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'handoff_acknowledged', callbackPolicyProfile: 'dev', callbackPayload: { status: 'accepted', eventAt: new Date().toISOString(), externalExecutionRef: 'job-fixture-1' }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, targetProviderSubmissionContractId: seeded.submission.providerSubmissionContractId, trustMetadata: { unsignedAllowed: true } });
  assert.equal(handoff.reconciliationResult.reconciliationStatus, 'applied');

  const ack = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPolicyProfile: 'internal_verified', callbackPayload: payloadAck, targetExecutionReceiptId: seeded.receipt.executionReceiptId, externalExecutionRef: 'job-fixture-1', trustMetadata: { callbackSigningKeyId: 'cbk_generic_default_v1', callbackSignature: signedAck, callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(ack.reconciliationResult.reconciliationStatus, 'applied');

  const dupWithin = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPolicyProfile: 'internal_verified', callbackPayload: payloadAck, targetExecutionReceiptId: seeded.receipt.executionReceiptId, externalExecutionRef: 'job-fixture-1', trustMetadata: { callbackSigningKeyId: 'cbk_generic_default_v1', callbackSignature: signedAck, callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(dupWithin.reconciliationResult.replayStatus, 'duplicate_within_window');
  assert.equal(dupWithin.reconciliationResult.reconciliationStatus, 'ignored');

  const conflictingPayload = { status: 'accepted', eventAt: new Date().toISOString(), externalExecutionRef: 'job-fixture-1', message: 'different' };
  const conflictingReplay = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPolicyProfile: 'production_verified', callbackPayload: conflictingPayload, targetExecutionReceiptId: seeded.receipt.executionReceiptId, externalExecutionRef: 'job-fixture-1', trustMetadata: { callbackSigningKeyId: 'cbk_generic_default_v1', callbackSignature: sign(conflictingPayload, 'generic-renderer-secret-v1'), callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(conflictingReplay.reconciliationResult.replayStatus, 'conflicting_replay');
  assert.equal(conflictingReplay.reconciliationResult.reconciliationStatus, 'policy_blocked');

  const donePayload = { status: 'completed', eventAt: new Date().toISOString(), resultSummary: 'ok', result: { output: 'ok' }, externalExecutionRef: 'job-fixture-1' };
  const doneSig = sign(donePayload, 'generic-renderer-secret-v1');
  const done = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'execution_completed', callbackPolicyProfile: 'production_verified', callbackPayload: donePayload, targetExecutionReceiptId: seeded.receipt.executionReceiptId, externalExecutionRef: 'job-fixture-1', trustMetadata: { callbackSigningKeyId: 'cbk_generic_default_v1', callbackSignature: doneSig, callbackSigningAlgorithm: 'HMAC-SHA256' } });
  assert.equal(done.reconciliationResult.reconciliationStatus, 'applied');

  const unsignedStrict = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'execution_started', callbackPolicyProfile: 'production_verified', callbackPayload: { status: 'started', eventAt: new Date().toISOString(), externalExecutionRef: 'job-fixture-2' }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, externalExecutionRef: 'job-fixture-2', trustMetadata: {} });
  assert.equal(unsignedStrict.reconciliationResult.reconciliationStatus, 'capability_mismatch');

  const replayCheck = await replayCheckExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPolicyProfile: 'dev', callbackPayload: payloadAck, targetExecutionReceiptId: seeded.receipt.executionReceiptId, externalExecutionRef: 'job-fixture-1' });
  assert.ok(['duplicate_within_window','duplicate_outside_window','conflicting_replay','first_seen'].includes(replayCheck.replayStatus));

  const exported = exportExecutionCallback(done.executionCallback, 'markdown');
  assert.ok(String(exported.content).includes('Replay Status'));

  const finalReceipt = await getExecutionReceipt(seeded.receipt.executionReceiptId);
  assert.equal(finalReceipt.executionReceipt.submissionStatus, 'closed');

  console.log('execution-callback-fixtures: ok');
})();
