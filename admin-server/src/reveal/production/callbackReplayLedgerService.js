import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/callback-replay-ledger';
const id = () => `rpl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

function matchTarget(a, b) {
  return (a.targetExecutionReceiptId && b.targetExecutionReceiptId && a.targetExecutionReceiptId === b.targetExecutionReceiptId)
    || (a.targetProviderSubmissionContractId && b.targetProviderSubmissionContractId && a.targetProviderSubmissionContractId === b.targetProviderSubmissionContractId);
}

async function listRows() {
  await fs.mkdir(ROOT, { recursive: true });
  const files = (await fs.readdir(ROOT)).filter((f) => f.endsWith('.json'));
  const rows = [];
  for (const f of files) {
    try { rows.push(JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'))); } catch {}
  }
  return rows;
}

async function writeRow(row) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(path.join(ROOT, `${row.replayLedgerId}.json`), JSON.stringify(row, null, 2), 'utf8');
}

export async function evaluateCallbackReplay({ callback, replayWindowPolicy }) {
  const now = new Date().toISOString();
  const nowMs = Date.parse(now);
  const rows = await listRows();
  const sameTargetType = rows.filter((r) => r.callbackType === callback.callbackType && matchTarget(r, callback) && (callback.externalExecutionRef ? r.externalExecutionRef === callback.externalExecutionRef : true));

  const exact = sameTargetType.find((r) => r.callbackDigest === callback.callbackDigest);
  const windowSeconds = Number(replayWindowPolicy?.windowSeconds || 0);
  if (exact) {
    const deltaSec = Math.floor((nowMs - Date.parse(exact.lastSeenAt || exact.firstSeenAt)) / 1000);
    const within = deltaSec <= windowSeconds;
    const replayStatus = within ? 'duplicate_within_window' : 'duplicate_outside_window';
    exact.lastSeenAt = now;
    exact.replayCount = Number(exact.replayCount || 1) + 1;
    exact.replayStatus = replayStatus;
    await writeRow(exact);
    return { replayStatus, replayDecision: within ? 'idempotent_ignore' : 'apply', replayLedgerRecord: exact };
  }

  const conflicting = sameTargetType.find((r) => r.callbackDigest !== callback.callbackDigest);
  if (conflicting) {
    const row = {
      replayLedgerId: id(),
      executionCallbackId: callback.executionCallbackId,
      callbackDigest: callback.callbackDigest,
      callbackDigestVersion: callback.callbackDigestVersion,
      providerType: callback.providerType,
      providerProfileId: callback.providerProfileId,
      callbackType: callback.callbackType,
      targetExecutionReceiptId: callback.targetExecutionReceiptId || null,
      targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId || null,
      externalExecutionRef: callback.externalExecutionRef || null,
      firstSeenAt: now,
      lastSeenAt: now,
      replayCount: 1,
      replayStatus: 'conflicting_replay',
      replayWindowPolicy,
      metadata: { deterministic: true }
    };
    await writeRow(row);
    return { replayStatus: 'conflicting_replay', replayDecision: 'block', replayLedgerRecord: row };
  }

  const row = {
    replayLedgerId: id(),
    executionCallbackId: callback.executionCallbackId,
    callbackDigest: callback.callbackDigest,
    callbackDigestVersion: callback.callbackDigestVersion,
    providerType: callback.providerType,
    providerProfileId: callback.providerProfileId,
    callbackType: callback.callbackType,
    targetExecutionReceiptId: callback.targetExecutionReceiptId || null,
    targetProviderSubmissionContractId: callback.targetProviderSubmissionContractId || null,
    externalExecutionRef: callback.externalExecutionRef || null,
    firstSeenAt: now,
    lastSeenAt: now,
    replayCount: 1,
    replayStatus: 'first_seen',
    replayWindowPolicy,
    metadata: { deterministic: true }
  };
  await writeRow(row);
  return { replayStatus: 'first_seen', replayDecision: 'apply', replayLedgerRecord: row };
}

export async function listReplayLedger() {
  const rows = await listRows();
  rows.sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)));
  return { replayLedger: rows };
}
