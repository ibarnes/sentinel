import fs from 'fs/promises';
import { writeJson, fileForReviewedFlow } from '../../storage/revealStorage.js';
import { createSnapshot } from '../../services/snapshotService.js';
import { createPlayerSession } from '../../player/playerSessionService.js';
import { buildReviewedPackage } from '../../services/packageService.js';
import { createNarrationScript, getScriptExport } from '../../script/narrationScriptService.js';

const flowId = 'fixture_script_flow';
await writeJson(fileForReviewedFlow(flowId), {
  id: flowId,
  name: 'Script Fixture Flow',
  description: 'Fixture for script generation',
  reviewVersion: 1,
  steps: [
    {
      id: 's1', index: 1, title: 'Upload CSV File', action: 'upload',
      intent: 'add customer data for analysis',
      target: { text: 'Upload CSV' },
      annotations: [{ author: 'qa', text: 'Use sample file' }],
      screenshots: {}
    },
    {
      id: 's2', index: 2, title: 'Run Analysis', action: 'click',
      intent: 'generate initial metrics',
      target: { text: 'Run Analysis' },
      annotations: [], screenshots: {}
    }
  ]
});

const flowScript = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
if (flowScript.error) throw new Error(`flow script failed: ${flowScript.error}`);
if (!flowScript.script.sections?.length) throw new Error('missing sections for flow script');

const snap = await createSnapshot(flowId, { createdBy: 'fixture' });
const snapScript = await createNarrationScript({ snapshotId: snap.snapshot.snapshotId, styleProfile: 'concise_training' });
if (snapScript.error) throw new Error(`snapshot script failed: ${snapScript.error}`);

const session = await createPlayerSession({ flowId });
const sessionScript = await createNarrationScript({ sessionId: session.session.sessionId, styleProfile: 'executive_overview' });
if (sessionScript.error) throw new Error(`session script failed: ${sessionScript.error}`);

if (flowScript.script.sections[0].narrationText === sessionScript.script.sections[0].narrationText) {
  throw new Error('style profile variation not applied');
}

const md = getScriptExport(flowScript.script, 'markdown');
if (md.error || !String(md.content || '').includes('## Sections')) throw new Error('markdown export structure invalid');

const pkg = await buildReviewedPackage(flowId);
const pkgScript = await createNarrationScript({ packagePath: pkg.archivePath, styleProfile: 'neutral_walkthrough' });
if (pkgScript.error) throw new Error(`package script failed: ${pkgScript.error}`);

const timingStableA = flowScript.script.totalEstimatedDurationMs;
const flowScript2 = await createNarrationScript({ flowId, styleProfile: 'neutral_walkthrough' });
const timingStableB = flowScript2.script.totalEstimatedDurationMs;
if (timingStableA !== timingStableB) throw new Error('timing estimation unstable');

await fs.rm(pkg.cleanupDir, { recursive: true, force: true });
console.log('OK script fixtures');
