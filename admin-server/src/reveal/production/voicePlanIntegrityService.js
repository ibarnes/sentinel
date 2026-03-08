import { getVoicePlanSnapshot, listVoicePlanSnapshots, computeVoicePlanSnapshotHash } from './voicePlanSnapshotService.js';

export async function verifyVoicePlanSnapshotIntegrity(voiceTrackPlanId, voicePlanSnapshotId) {
  const got = await getVoicePlanSnapshot(voiceTrackPlanId, voicePlanSnapshotId);
  if (got.error) return got;
  const s = got.snapshot;
  const recomputed = computeVoicePlanSnapshotHash(s);
  const stored = s.voicePlanSnapshotContentHash || null;

  let integrityStatus = stored ? (stored === recomputed ? 'match' : 'mismatch') : 'missing_hash';
  const reasonCodes = [];

  if (s.voicePlanSnapshotChainIndex > 1) {
    if (!s.parentVoicePlanSnapshotId || !s.parentVoicePlanSnapshotContentHash) {
      integrityStatus = 'broken_parent_link';
      reasonCodes.push('missing_parent_link');
    } else {
      const p = await getVoicePlanSnapshot(voiceTrackPlanId, s.parentVoicePlanSnapshotId);
      if (p.error) {
        integrityStatus = 'broken_parent_link';
        reasonCodes.push('missing_parent_snapshot');
      } else if ((p.snapshot.voicePlanSnapshotContentHash || null) !== s.parentVoicePlanSnapshotContentHash) {
        integrityStatus = 'broken_parent_link';
        reasonCodes.push('parent_hash_mismatch');
      }
    }
  }

  if (!reasonCodes.length) reasonCodes.push(integrityStatus === 'match' ? 'hash_match' : integrityStatus === 'mismatch' ? 'hash_mismatch' : 'missing_hash');

  return {
    voiceTrackPlanId,
    voicePlanSnapshotId,
    voicePlanSnapshotChainIndex: s.voicePlanSnapshotChainIndex,
    storedContentHash: stored,
    recomputedContentHash: recomputed,
    hashVersion: s.voicePlanSnapshotHashVersion,
    integrityStatus,
    reasonCodes
  };
}

export async function recomputeVoicePlanSnapshotIntegrity(voiceTrackPlanId) {
  const list = await listVoicePlanSnapshots(voiceTrackPlanId);
  const rows = [];
  for (const s of list.snapshots || []) {
    rows.push(await verifyVoicePlanSnapshotIntegrity(voiceTrackPlanId, s.voicePlanSnapshotId));
  }
  return {
    totalSnapshots: rows.length,
    matched: rows.filter((r) => r.integrityStatus === 'match').length,
    mismatched: rows.filter((r) => r.integrityStatus === 'mismatch').length,
    brokenChainLinks: rows.filter((r) => r.integrityStatus === 'broken_parent_link').length,
    missingHash: rows.filter((r) => r.integrityStatus === 'missing_hash').length,
    firstBrokenSnapshotId: (rows.find((r) => r.integrityStatus !== 'match') || {}).voicePlanSnapshotId || null,
    rows
  };
}
