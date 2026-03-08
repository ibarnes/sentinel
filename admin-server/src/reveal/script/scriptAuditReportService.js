import { getReviewedScript } from './reviewedScriptService.js';
import { listReviewedSnapshots, verifyReviewedSnapshotIntegrity, recomputeReviewedSnapshotIntegrity } from './reviewedScriptSnapshotService.js';
import { evaluatePublishGate } from './scriptPublishGateService.js';
import { getLatestTrustPublication } from './reviewedSnapshotTrustPublicationService.js';

export async function buildScriptAuditReport(scriptId, { requireLatestReviewedSnapshotIntegrity = false } = {}) {
  const env = await getReviewedScript(scriptId);
  if (env.error) return env;

  const snaps = await listReviewedSnapshots(scriptId);
  const latestSnapshot = (snaps.snapshots || []).length ? [...snaps.snapshots].sort((a, b) => Number(b.reviewedSnapshotChainIndex || 0) - Number(a.reviewedSnapshotChainIndex || 0))[0] : null;
  const latestIntegrity = latestSnapshot ? await verifyReviewedSnapshotIntegrity(scriptId, latestSnapshot.reviewedSnapshotId) : null;
  const chainSummary = await recomputeReviewedSnapshotIntegrity(scriptId);

  const latestTrust = await getLatestTrustPublication(scriptId);
  const gate = evaluatePublishGate({
    baseline: env.baseline,
    reviewed: env.reviewed,
    requireLatestReviewedSnapshotIntegrity,
    latestReviewedSnapshotIntegrity: latestIntegrity && !latestIntegrity.error ? latestIntegrity : null
  });

  const notesCount = (env.reviewed.sections || []).reduce((n, s) => n + (s.annotations || []).length, 0);

  const report = {
    scriptId,
    generatedAt: new Date().toISOString(),
    baselineSummary: {
      scriptId: env.baseline.scriptId,
      sourceType: env.baseline.sourceType,
      styleProfile: env.baseline.styleProfile,
      createdAt: env.baseline.createdAt,
      sectionCount: (env.baseline.sections || []).length
    },
    reviewedSummary: {
      reviewedScriptId: env.reviewed.reviewedScriptId,
      reviewVersion: env.reviewed.reviewVersion,
      reviewStatus: env.reviewed.reviewStatus,
      updatedAt: env.reviewed.updatedAt,
      sectionCount: (env.reviewed.sections || []).length
    },
    approvalTransitionHistory: (env.reviewed.editHistory || []).filter((e) => e.action === 'status_transition'),
    changedSectionCount: env.diff.changedSectionCount,
    firstDivergence: env.diff.firstDivergence,
    notesCount,
    publishGateDependency: { requireLatestReviewedSnapshotIntegrity },
    publishGate: gate,
    reviewedSnapshotIntegritySummary: {
      totalSnapshots: chainSummary.totalSnapshots,
      matched: chainSummary.matched,
      mismatched: chainSummary.mismatched,
      brokenChainLinks: chainSummary.brokenChainLinks,
      missingHash: chainSummary.missingHash,
      firstBrokenSnapshotId: chainSummary.firstBrokenSnapshotId
    },
    latestReviewedSnapshotHash: latestSnapshot?.reviewedSnapshotContentHash || null,
    latestReviewedSnapshotChainIndex: latestSnapshot?.reviewedSnapshotChainIndex || null,
    latestReviewedSnapshotIntegrityStatus: latestIntegrity?.integrityStatus || null,
    chainContinuitySummary: {
      ok: chainSummary.brokenChainLinks === 0,
      brokenChainLinks: chainSummary.brokenChainLinks
    },
    latestTrustPublicationSummary: latestTrust.error ? null : {
      trustPublicationId: latestTrust.trustPublication.trustPublicationId,
      chainHeadDigest: latestTrust.trustPublication.chainHeadDigest,
      trustPublicationSignatureStatus: latestTrust.trustPublication.trustPublicationSignatureStatus,
      publicationVersion: latestTrust.trustPublication.publicationVersion,
      publishedAt: latestTrust.trustPublication.publishedAt
    },
    availableReviewedSnapshots: (snaps.snapshots || []).map((s) => ({
      reviewedSnapshotId: s.reviewedSnapshotId,
      reviewVersion: s.reviewVersion,
      createdAt: s.createdAt,
      reviewStatusAtSnapshot: s.reviewStatusAtSnapshot,
      reviewedSnapshotChainIndex: s.reviewedSnapshotChainIndex,
      reviewedSnapshotContentHash: s.reviewedSnapshotContentHash,
      parentReviewedSnapshotId: s.parentReviewedSnapshotId
    })),
    latestSnapshotSummary: latestSnapshot ? latestSnapshot.manifest : null
  };

  return { report };
}
