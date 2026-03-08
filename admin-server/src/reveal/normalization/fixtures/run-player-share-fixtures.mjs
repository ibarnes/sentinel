import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { createPlayerSession } from '../../player/playerSessionService.js';
import { createShareLink, resolveShareLink, patchShareLink, getShareLink } from '../../player/shareLinkService.js';

const flowId = 'fixture_share_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Share Fixture',
  reviewVersion: 1,
  steps: [{ id: 's1', index: 1, title: 'A', action: 'click', screenshots: {}, annotations: [] }]
});

const flowShare = await createShareLink({ targetType: 'flow', targetRef: flowId, accessMode: 'public_token', embed: { embedMode: 'minimal_embed' } });
if (flowShare.error) throw new Error(flowShare.error);

const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
const snapShare = await createShareLink({ targetType: 'snapshot', targetRef: snap.snapshot.snapshotId, accessMode: 'public_token' });
if (snapShare.error) throw new Error(snapShare.error);

const session = await createPlayerSession({ flowId });
const sessionShare = await createShareLink({ targetType: 'session', targetRef: session.session.sessionId, accessMode: 'internal' });
if (sessionShare.error) throw new Error(sessionShare.error);

const rs = await resolveShareLink(flowShare.share.shareId);
if (rs.error) throw new Error(`resolve failed: ${rs.error}`);
if (rs.share.embed.embedMode !== 'minimal_embed') throw new Error('embed mode mismatch');

await patchShareLink(flowShare.share.shareId, { action: 'revoke' });
const revoked = await resolveShareLink(flowShare.share.shareId);
if (revoked.error !== 'share_revoked') throw new Error('expected revoked rejection');

const exp = await createShareLink({ targetType: 'flow', targetRef: flowId, expiresAt: '2000-01-01T00:00:00.000Z', accessMode: 'public_token' });
const expired = await resolveShareLink(exp.share.shareId);
if (expired.error !== 'share_expired') throw new Error('expected expired rejection');

await patchShareLink(sessionShare.share.shareId, { embed: { embedMode: 'kiosk_embed' } });
const updated = await getShareLink(sessionShare.share.shareId);
if (updated.error || updated.share.embed.embedMode !== 'kiosk_embed') throw new Error('embed override failed');

console.log('OK player share fixtures');
