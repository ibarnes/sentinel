import crypto from 'crypto';
import { getLatestVoiceTrustPublication, buildVoiceTrustSigningPayload } from './voiceTrustPublicationService.js';
import { verifyVoicePlanSnapshotIntegrity } from './voicePlanIntegrityService.js';
import { getSigningContext } from '../services/packageSigningService.js';

export async function verifyLatestVoice(voiceTrackPlanId) {
  const latest = await getLatestVoiceTrustPublication(voiceTrackPlanId);
  if (latest.error) return latest;
  const pub = latest.voiceTrustPublication;

  const integrity = await verifyVoicePlanSnapshotIntegrity(voiceTrackPlanId, pub.latestVoicePlanSnapshotId);

  let signatureValid = null;
  if (pub.voiceTrustPublicationSignatureStatus === 'signed' && pub.voiceTrustPublicationSignature) {
    const ctx = await getSigningContext();
    if (ctx.enabled) {
      const verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(JSON.stringify(buildVoiceTrustSigningPayload(pub)));
      verifier.end();
      signatureValid = verifier.verify(ctx.publicKey, pub.voiceTrustPublicationSignature, 'base64');
    } else {
      signatureValid = false;
    }
  }

  return {
    voiceTrackPlanId,
    latestVoicePlanSnapshotId: pub.latestVoicePlanSnapshotId,
    latestVoicePlanSnapshotContentHash: pub.latestVoicePlanSnapshotContentHash,
    latestVoicePlanSnapshotChainIndex: pub.latestVoicePlanSnapshotChainIndex,
    voiceChainHeadDigest: pub.voiceChainHeadDigest,
    voiceChainHeadDigestVersion: pub.voiceChainHeadDigestVersion,
    voiceTrustPublicationSignatureStatus: pub.voiceTrustPublicationSignatureStatus,
    voiceTrustPublicationSignatureValid: signatureValid,
    voiceTrustPublicationSigningKeyId: pub.voiceTrustPublicationSigningKeyId,
    voiceTrustPublicationSigningAlgorithm: pub.voiceTrustPublicationSigningAlgorithm,
    trustProfile: pub.trustProfile,
    integritySummary: integrity,
    publicationVersion: pub.publicationVersion,
    publishedAt: pub.publishedAt,
    voiceTrustPublicationId: pub.voiceTrustPublicationId
  };
}
