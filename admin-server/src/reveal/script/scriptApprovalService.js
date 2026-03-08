const ALLOWED = {
  draft: new Set(['in_review']),
  in_review: new Set(['approved', 'rejected']),
  approved: new Set(['published_ready']),
  rejected: new Set(['draft']),
  published_ready: new Set([])
};

export function canTransition(from, to) {
  return Boolean(ALLOWED[from]?.has(to));
}

export function applyStatusTransition(reviewed, { targetStatus, actor = null, reason = null } = {}) {
  const from = reviewed.reviewStatus || 'draft';
  const to = String(targetStatus || '');
  if (!canTransition(from, to)) return { error: 'invalid_status_transition', from, to };

  reviewed.reviewStatus = to;
  const now = new Date().toISOString();
  reviewed.updatedAt = now;
  reviewed.lastEditedBy = actor || reviewed.lastEditedBy || null;
  reviewed.approvalMetadata = reviewed.approvalMetadata || {};

  if (to === 'approved') {
    reviewed.approvalMetadata.approvedAt = now;
    reviewed.approvalMetadata.approvedBy = actor || null;
  }
  if (to === 'rejected') {
    reviewed.approvalMetadata.rejectedAt = now;
    reviewed.approvalMetadata.rejectedBy = actor || null;
    reviewed.approvalMetadata.rejectionReason = reason || null;
  }
  if (to === 'published_ready') {
    reviewed.approvalMetadata.publishedReadyAt = now;
    reviewed.approvalMetadata.publishedReadyBy = actor || null;
  }

  return { reviewed };
}
