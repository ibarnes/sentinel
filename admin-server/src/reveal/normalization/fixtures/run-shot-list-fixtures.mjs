import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createPlayerSession } from '../../player/playerSessionService.js';
import { buildReviewedPackage } from '../../services/packageService.js';
import { createShotList, exportShotList } from '../../production/shotListService.js';
import { createEditIntent, listEditIntents, applyEditIntentsToShotList, diffShotLists } from '../../production/editIntentService.js';
import { createShotListSnapshot, getShotListSnapshot } from '../../production/shotListSnapshotService.js';
import { buildAssemblyPackage } from '../../production/assemblyPackageService.js';

const flowId = 'fixture_shotlist_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'ShotList Fixture',
  reviewVersion: 1,
  steps: [
    { id: 'a', index: 1, title: 'Open Dashboard', action: 'navigate', intent: 'load dashboard', screenshots: {}, annotations: [] },
    { id: 'b', index: 2, title: 'Upload CSV', action: 'upload', intent: 'add customer data', annotations: [{ author: 'qa', text: 'Use sample.csv' }], screenshots: {} }
  ]
});

const script = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
if (script.error) throw new Error(script.error);
await initReviewedScript(script.script.scriptId, { actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'in_review', actor: 'fixture' });
await updateReviewedStatus(script.script.scriptId, { targetStatus: 'approved', actor: 'fixture' });
await createReviewedSnapshot(script.script.scriptId, { actor: 'fixture' });
await publishTrust(script.script.scriptId);

const byScript = await createShotList({ scriptId: script.script.scriptId, publishReady: true });
if (byScript.error) throw new Error(`script shot list failed: ${byScript.error}`);

const byFlow = await createShotList({ flowId });
if (byFlow.error) throw new Error(`flow shot list failed: ${byFlow.error}`);

const session = await createPlayerSession({ flowId });
const bySession = await createShotList({ sessionId: session.session.sessionId });
if (bySession.error) throw new Error(`session shot list failed: ${bySession.error}`);

const pkg = await buildReviewedPackage(flowId);
const byPkg = await createShotList({ packagePath: pkg.archivePath });
if (byPkg.error) throw new Error(`package shot list failed: ${byPkg.error}`);

const md = exportShotList(byScript.shotList, 'markdown');
if (md.error || !String(md.content).includes('## Scenes')) throw new Error('markdown export invalid');

const timingStableA = byFlow.shotList.totalEstimatedDurationMs;
const timingStableB = (await createShotList({ flowId })).shotList.totalEstimatedDurationMs;
if (timingStableA !== timingStableB) throw new Error('timing stability failed');

// edit intents + effective recompute
const firstShot = byFlow.shotList.scenes[0].shots[0];
await createEditIntent(byFlow.shotList.shotListId, { shotId: firstShot.shotId, type: 'hold_extension_ms', value: 500, createdBy: 'fixture' });
await createEditIntent(byFlow.shotList.shotListId, { shotId: firstShot.shotId, type: 'note', value: 'Hold intro longer', createdBy: 'fixture' });
const intents = await listEditIntents(byFlow.shotList.shotListId);
if ((intents.editIntents || []).length < 2) throw new Error('edit intent creation failed');

const effective = applyEditIntentsToShotList(byFlow.shotList, intents.editIntents);
const diff = diffShotLists(byFlow.shotList, effective);
if (diff.changedShotCount < 1) throw new Error('diff should detect edited shot');

// snapshot immutability
const snap = await createShotListSnapshot(byFlow.shotList.shotListId, { createdBy: 'fixture' });
if (snap.error) throw new Error(`shot list snapshot failed: ${snap.error}`);
const snapId = snap.snapshot.shotListSnapshotId;
await createEditIntent(byFlow.shotList.shotListId, { shotId: firstShot.shotId, type: 'disable_shot', value: true, createdBy: 'fixture' });
const snapRead = await getShotListSnapshot(byFlow.shotList.shotListId, snapId);
if (snapRead.error) throw new Error('snapshot read failed');
if (snapRead.snapshot.frozenShotList.scenes[0].shots.find((s) => s.shotId === firstShot.shotId)?.disabled) {
  throw new Error('snapshot mutated after later intents');
}

// assembly package structure
const assemblyJson = await buildAssemblyPackage({ shotListId: byFlow.shotList.shotListId, format: 'json' });
if (assemblyJson.error) throw new Error(`assembly json failed: ${assemblyJson.error}`);
const parsed = JSON.parse(assemblyJson.content);
if (!parsed['assembly-manifest.json'] || !parsed['shot-list.json'] || !parsed['trust-summary.json']) throw new Error('assembly package structure invalid');

const blocked = await createShotList({ scriptId: script.script.scriptId, publishReady: true, requireLatestTrustPublication: true });
if (!blocked.error) throw new Error('expected publish gate block when trust publication signature requirement is enabled without signed key');

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK shot list fixtures');
