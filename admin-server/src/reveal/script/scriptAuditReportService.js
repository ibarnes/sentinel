import { getReviewedScript } from './reviewedScriptService.js';
import { listReviewedSnapshots } from './reviewedScriptSnapshotService.js';
import { evaluatePublishGate } from './scriptPublishGateService.js';

export async function buildScriptAuditReport(scriptId) {
  const env = await getReviewedScript(scriptId);
  if (env.error) return env;

  const snaps = await listReviewedSnapshots(scriptId);
  const gate = evaluatePublishGate({ baseline: env.baseline, reviewed: env.reviewed });

  const notesCount = (env.reviewed.sections || []).reduce((n, s) => n + (s.annotations || []).length, 0);
  const latestSnapshot = (snaps.snapshots || [])[0] || null;

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
    publishGate: gate,
    availableReviewedSnapshots: (snaps.snapshots || []).map((s) => ({ reviewedSnapshotId: s.reviewedSnapshotId, reviewVersion: s.reviewVersion, createdAt: s.createdAt, reviewStatusAtSnapshot: s.reviewStatusAtSnapshot })),
    latestSnapshotSummary: latestSnapshot ? latestSnapshot.manifest : null
  };

  return { report };
}
