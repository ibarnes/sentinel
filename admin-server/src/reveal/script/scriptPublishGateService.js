function validTiming(t) {
  if (!t) return false;
  const vals = [t.estimatedDurationMs, t.leadInMs, t.leadOutMs].map((v) => Number(v));
  return vals.every((n) => Number.isFinite(n) && n >= 0);
}

export function evaluatePublishGate({ baseline = null, reviewed = null, requireApprovalMetadata = true, requireLatestReviewedSnapshotIntegrity = false, latestReviewedSnapshotIntegrity = null } = {}) {
  const blockingReasons = [];
  const warnings = [];

  if (!reviewed) blockingReasons.push('review_missing');
  if (!baseline) blockingReasons.push('baseline_missing');

  if (reviewed) {
    if (!['approved', 'published_ready'].includes(reviewed.reviewStatus)) {
      blockingReasons.push('review_status_not_publishable');
    }

    const sections = reviewed.sections || [];
    if (!sections.length) blockingReasons.push('sections_missing');

    const stepIndexes = sections.map((s) => Number(s.stepIndex));
    const expected = Array.from({ length: stepIndexes.length }, (_, i) => i);
    if (JSON.stringify(stepIndexes) !== JSON.stringify(expected)) {
      blockingReasons.push('section_order_invalid');
    }

    for (const sec of sections) {
      if (!String(sec.narrationText || '').trim()) {
        blockingReasons.push(`missing_narration:${sec.sectionId}`);
      }
      if (!validTiming(sec.timing)) {
        blockingReasons.push(`invalid_timing:${sec.sectionId}`);
      }
    }

    if (requireApprovalMetadata) {
      if (['approved', 'published_ready'].includes(reviewed.reviewStatus)) {
        if (!reviewed.approvalMetadata?.approvedAt && reviewed.reviewStatus !== 'published_ready') {
          warnings.push('approved_without_approvedAt');
        }
      }
    }
  }

  if (requireLatestReviewedSnapshotIntegrity) {
    if (!latestReviewedSnapshotIntegrity) {
      blockingReasons.push('latest_reviewed_snapshot_missing');
    } else if (latestReviewedSnapshotIntegrity.integrityStatus !== 'match') {
      if (latestReviewedSnapshotIntegrity.integrityStatus === 'broken_parent_link') {
        blockingReasons.push('reviewed_snapshot_chain_broken');
      } else {
        blockingReasons.push('latest_reviewed_snapshot_integrity_failed');
      }
    }
  }

  return {
    canPublish: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    evaluatedAt: new Date().toISOString()
  };
}
