import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { loadFromFlow, loadFromSnapshot, loadFromPackage } from '../player/flowPlayerService.js';
import { readSession } from '../player/sessionStorageService.js';
import { deriveNarrationSections } from './scriptDerivationService.js';
import { estimateSectionTiming, estimateTotalDuration } from './scriptTimingService.js';
import { getStyleProfile, listStyleProfiles } from './styleProfileService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/scripts';

function nowIso() { return new Date().toISOString(); }
function scriptId() { return `ns_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function fileFor(id) { return path.join(ROOT, `${id}.json`); }

async function writeScript(s) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(s.scriptId), JSON.stringify(s, null, 2), 'utf8');
}

export async function getScript(id) {
  try {
    const script = JSON.parse(await fs.readFile(fileFor(id), 'utf8'));
    return { script };
  } catch {
    return { error: 'script_not_found' };
  }
}

async function loadModel({ flowId = null, snapshotId = null, sessionId = null, packagePath = null } = {}) {
  const provided = [!!flowId, !!snapshotId, !!sessionId, !!packagePath].filter(Boolean).length;
  if (provided === 0) return { error: 'missing_source_input' };
  if (provided > 1) return { error: 'conflicting_source_inputs' };

  if (flowId) {
    const loaded = await loadFromFlow(flowId);
    if (loaded.error) return loaded;
    return { sourceType: 'reviewed_flow', sourceRef: { flowId }, model: loaded.model };
  }
  if (snapshotId) {
    const loaded = await loadFromSnapshot(null, snapshotId);
    if (loaded.error) return loaded;
    return { sourceType: 'immutable_snapshot', sourceRef: { snapshotId }, model: loaded.model };
  }
  if (sessionId) {
    const s = await readSession(sessionId);
    if (!s || !s.model) return { error: 'session_not_found' };
    return {
      sourceType: 'player_session',
      sourceRef: { sessionId, currentStepIndex: s.currentStepIndex, sourceType: s.sourceType, sourceRef: s.sourceRef || null, embed: s.embed || null, interactionState: s.interactionState || null },
      model: s.model
    };
  }

  const loaded = await loadFromPackage(packagePath);
  if (loaded.error) return loaded;
  return { sourceType: 'reveal_package', sourceRef: { packagePath: path.basename(packagePath) }, model: loaded.model };
}

export async function createNarrationScript({ flowId = null, snapshotId = null, sessionId = null, packagePath = null, styleProfile = 'neutral_walkthrough', createdBy = null } = {}) {
  const style = getStyleProfile(styleProfile);
  if (!style) return { error: 'invalid_style_profile' };

  const loaded = await loadModel({ flowId, snapshotId, sessionId, packagePath });
  if (loaded.error) return loaded;

  const steps = loaded.model?.steps || [];
  if (!steps.length) return { error: 'missing_steps' };

  const sections = deriveNarrationSections(steps, style).map((sec) => {
    const timing = estimateSectionTiming(sec, style);
    return { ...sec, timing };
  });

  const script = {
    scriptId: scriptId(),
    sourceType: loaded.sourceType,
    sourceRef: loaded.sourceRef,
    title: loaded.model.title || 'Reveal Narration Script',
    description: loaded.model.description || null,
    createdAt: nowIso(),
    createdBy,
    scriptVersion: 'v1',
    styleProfile: style.id,
    totalEstimatedDurationMs: estimateTotalDuration(sections),
    sections,
    metadata: {
      flowId: loaded.model.flowId || null,
      stepCount: steps.length
    }
  };

  await writeScript(script);
  return { script };
}

function msToHuman(ms = 0) {
  const s = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function exportScriptMarkdown(script) {
  const lines = [];
  lines.push(`# ${script.title}`);
  if (script.description) lines.push('', script.description);
  lines.push('', `- Script ID: ${script.scriptId}`);
  lines.push(`- Source Type: ${script.sourceType}`);
  lines.push(`- Style Profile: ${script.styleProfile}`);
  lines.push(`- Total Estimated Duration: ${msToHuman(script.totalEstimatedDurationMs)}`);
  lines.push(`- Created At: ${script.createdAt}`);
  lines.push('', '## Sections');

  for (const sec of script.sections || []) {
    lines.push('', `### ${sec.stepIndex + 1}. ${sec.title}`);
    lines.push(`- Narration: ${sec.narrationText}`);
    lines.push(`- On-screen: ${sec.onScreenText || 'n/a'}`);
    lines.push(`- Timing: ${msToHuman(sec.timing?.estimatedDurationMs)} (lead-in ${sec.timing?.leadInMs || 0}ms, lead-out ${sec.timing?.leadOutMs || 0}ms)`);
    lines.push(`- Visual refs: before=${sec.visualRefs?.screenshotBefore || 'n/a'}, after=${sec.visualRefs?.screenshotAfter || 'n/a'}, highlight=${sec.visualRefs?.highlight || 'n/a'}`);
    lines.push(`- Hotspots: ${(sec.visualRefs?.hotspotIds || []).join(', ') || 'none'}`);
    lines.push(`- Emphasis: ${sec.emphasis || 'none'}`);
  }

  return lines.join('\n') + '\n';
}

export function getScriptExport(script, format = 'json') {
  if (format === 'json') {
    return { contentType: 'application/json', filename: `${script.scriptId}.json`, content: JSON.stringify(script, null, 2) };
  }
  if (format === 'markdown') {
    return { contentType: 'text/markdown; charset=utf-8', filename: `${script.scriptId}.md`, content: exportScriptMarkdown(script) };
  }
  return { error: 'invalid_export_format' };
}

export { listStyleProfiles };
