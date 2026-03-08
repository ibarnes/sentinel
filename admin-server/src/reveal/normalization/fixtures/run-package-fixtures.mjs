import fs from 'fs/promises';
import { buildReviewedPackage, buildSnapshotPackage, getReviewedPackageVerificationMetadata } from '../../services/packageService.js';
import { getVerificationKeyset } from '../../services/packageSigningService.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { fileForReviewedFlow, writeJson } from '../../storage/revealStorage.js';
import { verifyVerificationMetadata } from '../../services/packageSigningService.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';

const pexec = promisify(execFile);
const flowId = 'fixture_flow_package';

const reviewed = {
  id: flowId,
  name: 'Fixture Package Flow',
  appHost: 'app.test',
  reviewVersion: 1,
  steps: [
    { id: 'p1', index: 1, title: 'Step A', action: 'click', intent: null, target: { elementType: 'button', text: 'Open' }, page: { url: 'https://app.test' }, screenshots: { beforeUrl: '/reveal/storage/assets/missing/a/before.jpg' }, confidence: 0.8, annotations: [] }
  ]
};

await writeJson(fileForReviewedFlow(flowId), reviewed);
const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
if (snap.error) throw new Error(snap.error);

// unsigned fallback
const oldPriv = process.env.REVEAL_SIGNING_PRIVATE_KEY;
const oldPub = process.env.REVEAL_SIGNING_PUBLIC_KEY;
const oldKid = process.env.REVEAL_SIGNING_KEY_ID;
const oldTrust = process.env.REVEAL_TRUST_PROFILE_ID;
delete process.env.REVEAL_SIGNING_PRIVATE_KEY;
delete process.env.REVEAL_SIGNING_PUBLIC_KEY;
delete process.env.REVEAL_SIGNING_KEY_ID;

const rpUnsigned = await buildReviewedPackage(flowId);
if (rpUnsigned.error) throw new Error(rpUnsigned.error);
if (rpUnsigned.manifest.signatureStatus !== 'unsigned') throw new Error('expected unsigned package without key');
const ksUnsigned = await getVerificationKeyset();
if (ksUnsigned.keysetSignatureStatus !== 'unsigned') throw new Error('expected unsigned keyset without keyset signing material');

// signed mode
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
process.env.REVEAL_SIGNING_PRIVATE_KEY = privateKey;
process.env.REVEAL_SIGNING_PUBLIC_KEY = publicKey;
process.env.REVEAL_SIGNING_KEY_ID = 'fixture-key';
process.env.REVEAL_TRUST_PROFILE_ID = 'local_dev';

const ks = await getVerificationKeyset();
if (!ks.keysetVersion || !Array.isArray(ks.keys)) throw new Error('keyset payload malformed');
if (ks.keys.length < 1) throw new Error('expected active key in keyset');

const rp = await buildReviewedPackage(flowId);
if (rp.error) throw new Error(rp.error);
const sp = await buildSnapshotPackage(flowId, snap.snapshot.snapshotId);
if (sp.error) throw new Error(sp.error);
if (rp.manifest.signatureStatus !== 'signed') throw new Error('expected signed reviewed package');
if (sp.manifest.signatureStatus !== 'signed') throw new Error('expected signed snapshot package');

async function listZip(z) {
  const { stdout } = await pexec('unzip', ['-Z1', z]);
  return stdout.split('\n').map((x) => x.trim()).filter(Boolean).sort();
}

const rList = await listZip(rp.archivePath);
const sList = await listZip(sp.archivePath);

for (const needed of ['manifest.json', 'reviewed-flow.json', 'reviewed-flow.md', 'integrity.json']) {
  if (!rList.includes(needed)) throw new Error(`reviewed package missing ${needed}`);
}
for (const needed of ['manifest.json', 'snapshot.json', 'snapshot.md', 'integrity.json']) {
  if (!sList.includes(needed)) throw new Error(`snapshot package missing ${needed}`);
}

const { stdout: manOut } = await pexec('unzip', ['-p', rp.archivePath, 'manifest.json']);
const man = JSON.parse(manOut);
if (!Array.isArray(man.omittedAssets)) throw new Error('manifest omittedAssets missing');
if (!man.packageSignature) throw new Error('manifest missing packageSignature');

// verify success
const verifyOk = await verifyVerificationMetadata(man, { enabled: true, publicKey, signingKeyId: 'fixture-key', signerKeyFingerprint: man.signerKeyFingerprint });
if (verifyOk.status !== 'verified') throw new Error(`verify expected verified got ${verifyOk.status}`);

// signed package with unpublished key context override
const verifyUnpublished = await verifyVerificationMetadata(man, {
  enabled: true,
  publicKey,
  signingKeyId: 'fixture-key',
  signerKeyFingerprint: man.signerKeyFingerprint,
  keyset: { keysetVersion: 'test-v1', keys: [] }
});
if (verifyUnpublished.status !== 'verified_with_unpublished_key') throw new Error('expected verified_with_unpublished_key');

// tampered signature payload
const tampered = { ...man, packageContentHash: 'tampered-hash' };
const verifyBad = await verifyVerificationMetadata(tampered, { enabled: true, publicKey, signingKeyId: 'fixture-key', signerKeyFingerprint: man.signerKeyFingerprint });
if (verifyBad.status !== 'invalid_signature') throw new Error('expected invalid_signature for tampered payload');

// signer key mismatch
const verifyMismatch = await verifyVerificationMetadata(man, { enabled: true, publicKey, signingKeyId: 'other-key', signerKeyFingerprint: 'deadbeef' });
if (verifyMismatch.status !== 'signer_key_mismatch') throw new Error('expected signer_key_mismatch');

// unknown trust profile
const unknownTrust = await verifyVerificationMetadata({ ...man, trustProfileId: 'unknown_profile' }, { enabled: true, publicKey, signingKeyId: 'fixture-key', signerKeyFingerprint: man.signerKeyFingerprint });
if (unknownTrust.status !== 'unknown_trust_profile') throw new Error('expected unknown_trust_profile');

// lifecycle-aware verification statuses
const retired = await verifyVerificationMetadata(man, {
  enabled: true,
  publicKey,
  signingKeyId: 'fixture-key',
  signerKeyFingerprint: man.signerKeyFingerprint,
  keyset: {
    keysetVersion: 'test-v2',
    keys: [{ signingKeyId: 'fixture-key', signerKeyFingerprint: man.signerKeyFingerprint, keyStatus: 'retired', retiresAt: '2000-01-01T00:00:00.000Z' }]
  }
});
if (retired.status !== 'verified_with_retired_key') throw new Error('expected verified_with_retired_key');

const revoked = await verifyVerificationMetadata(man, {
  enabled: true,
  publicKey,
  signingKeyId: 'fixture-key',
  signerKeyFingerprint: man.signerKeyFingerprint,
  keyset: {
    keysetVersion: 'test-v3',
    keys: [{ signingKeyId: 'fixture-key', signerKeyFingerprint: man.signerKeyFingerprint, keyStatus: 'revoked', revokedAt: '2020-01-01T00:00:00.000Z' }]
  }
});
if (revoked.status !== 'signer_key_revoked') throw new Error('expected signer_key_revoked');

// malformed metadata
const malformed = await verifyVerificationMetadata({}, { enabled: true, publicKey, signingKeyId: 'fixture-key', signerKeyFingerprint: man.signerKeyFingerprint });
if (!['content_hash_mismatch','missing_signature','malformed_verification_payload'].includes(malformed.status)) throw new Error('expected malformed verification failure');

// verification metadata endpoint helper
const vm = await getReviewedPackageVerificationMetadata(flowId);
if (!vm.verificationMetadata) throw new Error('missing verification metadata helper output');

await fs.rm(rp.cleanupDir, { recursive: true, force: true });
await fs.rm(sp.cleanupDir, { recursive: true, force: true });
await fs.rm(rpUnsigned.cleanupDir, { recursive: true, force: true });

if (oldPriv) process.env.REVEAL_SIGNING_PRIVATE_KEY = oldPriv; else delete process.env.REVEAL_SIGNING_PRIVATE_KEY;
if (oldPub) process.env.REVEAL_SIGNING_PUBLIC_KEY = oldPub; else delete process.env.REVEAL_SIGNING_PUBLIC_KEY;
if (oldKid) process.env.REVEAL_SIGNING_KEY_ID = oldKid; else delete process.env.REVEAL_SIGNING_KEY_ID;
if (oldTrust) process.env.REVEAL_TRUST_PROFILE_ID = oldTrust; else delete process.env.REVEAL_TRUST_PROFILE_ID;

console.log(`OK package fixtures reviewed=${rList.length} snapshot=${sList.length} signed=${rp.manifest.signatureStatus}`);
