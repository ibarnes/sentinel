import { deriveHotspots, deriveOverlay } from '../../player/interactionDerivationService.js';
import { createPlayerSession, patchPlayerSession, getPlayerSession } from '../../player/playerSessionService.js';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';

const flowId = 'fixture_player_interaction_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Interaction Fixture',
  reviewVersion: 1,
  steps: [
    {
      id: 'i1', index: 1, title: 'Target Step', action: 'click', intent: 'Click target',
      target: { text: 'Upload', elementBox: { x: 100, y: 100, width: 200, height: 80 } },
      metadata: { normalizedHighlightBox: { x: 100, y: 100, width: 200, height: 80, normalizedViewport: { width: 1000, height: 800 } } },
      annotations: [{ author: 'a', text: 'Important target' }], screenshots: {}
    },
    { id: 'i2', index: 2, title: 'Auto Step', action: 'navigate', intent: null, annotations: [], screenshots: {}, overlay: { progressionMode: 'auto', stepDurationMs: 2500 } }
  ]
});

const hs = deriveHotspots({ target: { text: 'Upload' }, metadata: { normalizedHighlightBox: { x: 10, y: 20, width: 100, height: 40, normalizedViewport: { width: 1000, height: 500 } } }, annotations: [{ text: 'note' }] }, 0, 2);
if (!hs.length) throw new Error('hotspot derivation failed');
const ov = deriveOverlay({ title: 'X', intent: 'Y', annotations: [] }, hs, 0);
if (!ov || !ov.title) throw new Error('overlay derivation failed');

const s = await createPlayerSession({ flowId });
if (s.error) throw new Error(s.error);
const sid = s.session.sessionId;

const blocked = await patchPlayerSession(sid, { action: 'next' });
if (blocked.error !== 'progression_blocked') throw new Error('expected progression_blocked before hotspot interaction');

const hsId = s.model.steps[0].hotspots?.[0]?.hotspotId;
if (!hsId) throw new Error('missing primary hotspot');
await patchPlayerSession(sid, { action: 'interactHotspot', jumpTo: hsId });
const moved = await patchPlayerSession(sid, { action: 'next' });
if (moved.error) throw new Error(`next after interaction failed: ${moved.error}`);

await patchPlayerSession(sid, { action: 'dismissOverlay' });
const g = await getPlayerSession(sid);
if (g.error) throw new Error(g.error);
if (!g.session.interactionState['0']?.overlayDismissed) throw new Error('overlay dismiss state not tracked');

console.log('OK player interaction fixtures');
