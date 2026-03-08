import { getLatestTrustPublication, buildTrustPublicationSigningPayload } from './reviewedSnapshotTrustPublicationService.js';
import { verifyPayloadSignature, getSigningContext } from '../services/packageSigningService.js';
import { verifyReviewedSnapshotIntegrity } from './reviewedScriptSnapshotService.js';

export async function verifyLatestReviewedSnapshot(scriptId) {
  const latest = await getLatestTrustPublication(scriptId);
  if (latest.error) return latest;

  const tp = latest.trustPublication;
  const integrity = await verifyReviewedSnapshotIntegrity(scriptId, tp.latestReviewedSnapshotId);

  let signatureValid = false;
  if (tp.trustPublicationSignatureStatus === 'signed' && tp.trustPublicationSignature) {
    const ctx = await getSigningContext();
    if (ctx.enabled) {
      signatureValid = verifyPayloadSignature(buildTrustPublicationSigningPayload(tp), tp.trustPublicationSignature, ctx);
    }
  }

  return {
    scriptId,
    latestReviewedSnapshotId: tp.latestReviewedSnapshotId,
    latestReviewedSnapshotContentHash: tp.latestReviewedSnapshotContentHash,
    latestReviewedSnapshotChainIndex: tp.latestReviewedSnapshotChainIndex,
    chainHeadDigest: tp.chainHeadDigest,
    chainHeadDigestVersion: tp.chainHeadDigestVersion,
    trustPublicationSignatureStatus: tp.trustPublicationSignatureStatus,
    trustPublicationSignatureValid: tp.trustPublicationSignatureStatus === 'signed' ? signatureValid : null,
    trustPublicationSigningKeyId: tp.trustPublicationSigningKeyId,
    trustPublicationSigningAlgorithm: tp.trustPublicationSigningAlgorithm,
    trustProfile: tp.trustProfile || null,
    integritySummary: integrity,
    publicationVersion: tp.publicationVersion,
    publishedAt: tp.publishedAt,
    trustPublicationId: tp.trustPublicationId
  };
}
