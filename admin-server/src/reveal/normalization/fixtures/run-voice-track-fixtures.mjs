import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createShotList } from '../../production/shotListService.js';
import { createVoiceTrackPlan, exportVoiceTrackPlan } from '../../production/voiceTrackPlanService.js';

const flowId = 'fixture_voice_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Voice Fixture Flow',
  reviewVersion: 1,
  steps: [
    { id: 'v1', index: 1, title: 'Open Dashboard', action: 'navigate', intent: 'open dashboard view', screenshots: {}, annotations: [] },
    { id: 'v2', index: 2, title: 'Upload CSV', action: 'upload', intent: 'upload customer csv for analysis', screenshots: {}, annotations: [{ author: 'qa', text: 'Use sample' }] }
  ]
});

const script = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
if (script.error) throw new Error(script.error);
await initReviewedScript(script.script.scriptId, { actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'in_review', actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'approved', actor: 'fixture' });

const fromScript = await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true });
if (fromScript.error) throw new Error(`voice from script failed: ${fromScript.error}`);
if (!fromScript.voiceTrackPlan.segments.length) throw new Error('no segments');
if (!fromScript.voiceTrackPlan.captions.length) throw new Error('no captions');

const shot = await createShotList({ scriptId: script.script.scriptId, publishReady: true });
if (shot.error) throw new Error(shot.error);
const fromShot = await createVoiceTrackPlan({ shotListId: shot.shotList.shotListId });
if (fromShot.error) throw new Error(`voice from shot list failed: ${fromShot.error}`);

const srt = exportVoiceTrackPlan(fromScript.voiceTrackPlan, 'srt');
if (srt.error || !String(srt.content).includes('-->')) throw new Error('invalid srt export');
const vtt = exportVoiceTrackPlan(fromScript.voiceTrackPlan, 'vtt');
if (vtt.error || !String(vtt.content).startsWith('WEBVTT')) throw new Error('invalid vtt export');
const md = exportVoiceTrackPlan(fromScript.voiceTrackPlan, 'markdown');
if (md.error || !String(md.content).includes('## Segments')) throw new Error('invalid markdown export');

const stableA = fromScript.voiceTrackPlan.totalEstimatedDurationMs;
const stableB = (await createVoiceTrackPlan({ scriptId: script.script.scriptId, publishReady: true })).voiceTrackPlan.totalEstimatedDurationMs;
if (stableA !== stableB) throw new Error('timing stability failed');

const scriptUnapproved = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
await initReviewedScript(scriptUnapproved.script.scriptId, { actor: 'fixture' });
const blocked = await createVoiceTrackPlan({ scriptId: scriptUnapproved.script.scriptId, publishReady: true });
if (blocked.error !== 'script_not_approved') throw new Error('expected unapproved script block');

console.log('OK voice track fixtures');
