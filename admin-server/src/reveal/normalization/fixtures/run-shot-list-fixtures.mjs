import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createNarrationScript } from '../../script/narrationScriptService.js';
import { initReviewedScript, updateReviewedStatus } from '../../script/reviewedScriptService.js';
import { createReviewedSnapshot } from '../../script/reviewedScriptSnapshotService.js';
import { publishTrust } from '../../script/reviewedSnapshotTrustPublicationService.js';
import { createPlayerSession } from '../../player/playerSessionService.js';
import { buildReviewedPackage } from '../../services/packageService.js';
import { createShotList, exportShotList } from '../../production/shotListService.js';

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
if (!byScript.shotList.scenes?.length) throw new Error('empty scenes from script');

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

const blocked = await createShotList({ scriptId: script.script.scriptId, publishReady: true, requireLatestTrustPublication: true });
if (!blocked.error) {
  throw new Error('expected publish gate block when trust publication signature requirement is enabled without signed key');
}

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK shot list fixtures');
