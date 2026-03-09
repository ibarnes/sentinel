import assert from 'assert';
import { verifyExecutionCallback } from '../../production/callbackVerificationService.js';
import { createExecutionCallback, exportExecutionCallback } from '../../production/executionCallbackService.js';
import { listProviderSubmissionContracts } from '../../production/providerSubmissionService.js';
import { createExecutionReceipt, getExecutionReceipt } from '../../production/executionReceiptService.js';

async function seed() {
  const list = await listProviderSubmissionContracts({});
  const submission = list.providerSubmissionContracts?.[0];
  if (!submission) throw new Error('fixture_requires_existing_provider_submission_contract');
  const receipt = await createExecutionReceipt({ providerSubmissionContractId: submission.providerSubmissionContractId });
  if (receipt.error) throw new Error(receipt.error);
  return { submission, receipt: receipt.executionReceipt };
}

(async () => {
  const shape = verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: { status: 'accepted', eventAt: new Date().toISOString() }, trustMetadata: { unsignedAllowed: true } });
  assert.ok(['valid_with_warnings','valid'].includes(shape.status));

  const seeded = await seed();

  const handoff = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'handoff_acknowledged', callbackPayload: { status: 'accepted', eventAt: new Date().toISOString() }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, targetProviderSubmissionContractId: seeded.submission.providerSubmissionContractId, trustMetadata: { unsignedAllowed: true } });
  assert.equal(handoff.reconciliationResult.reconciliationStatus, 'applied');

  const ack = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: { status: 'accepted', eventAt: new Date().toISOString() }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, trustMetadata: { unsignedAllowed: true } });
  assert.equal(ack.reconciliationResult.reconciliationStatus, 'applied');

  const done = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'execution_completed', callbackPayload: { status: 'completed', eventAt: new Date().toISOString(), result: { output: 'ok' } }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, trustMetadata: { unsignedAllowed: true } });
  assert.equal(done.reconciliationResult.reconciliationStatus, 'applied');

  const rewind = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: { status: 'accepted', eventAt: new Date().toISOString() }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, trustMetadata: { unsignedAllowed: true } });
  assert.ok(['blocked','policy_blocked'].includes(rewind.reconciliationResult.reconciliationStatus));

  const invalidSig = verifyExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_acknowledged', callbackPayload: { status: 'accepted', eventAt: new Date().toISOString() }, trustMetadata: { callbackSignature: 'deadbeef', signingSecret: 'abc' } });
  assert.equal(invalidSig.status, 'invalid_signature');

  const missingTarget = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'provider_note', callbackPayload: { status: 'note', eventAt: new Date().toISOString(), message: 'x' }, trustMetadata: { unsignedAllowed: true } });
  assert.equal(missingTarget.reconciliationResult.reconciliationStatus, 'target_not_found');

  const replay = await createExecutionCallback({ providerType: 'generic_renderer', providerProfileId: 'default', callbackType: 'execution_completed', callbackPayload: { status: 'completed', eventAt: new Date().toISOString() }, targetExecutionReceiptId: seeded.receipt.executionReceiptId, trustMetadata: { unsignedAllowed: true } });
  assert.ok(['blocked','policy_blocked'].includes(replay.reconciliationResult.reconciliationStatus));

  const exported = exportExecutionCallback(done.executionCallback, 'markdown');
  assert.ok(String(exported.content).includes('# Execution Callback'));

  const finalReceipt = await getExecutionReceipt(seeded.receipt.executionReceiptId);
  assert.equal(finalReceipt.executionReceipt.submissionStatus, 'closed');

  console.log('execution-callback-fixtures: ok');
})();
