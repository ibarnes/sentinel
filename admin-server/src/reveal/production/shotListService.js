import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { loadFromFlow, loadFromSnapshot, loadFromPackage } from '../player/flowPlayerService.js';
import { readSession } from '../player/sessionStorageService.js';
import { getReviewedScript } from '../script/reviewedScriptService.js';
import { getLatestTrustPublication } from '../script/reviewedSnapshotTrustPublicationService.js';
import { evaluatePublishGate } from '../script/scriptPublishGateService.js';
import { deriveScenesAndShots } from './shotDerivationService.js';
import { mapSceneTimeline } from './sceneTimelineService.js';

const ROOT = '/home/ec2-user/.openclaw/workspace/reveal/storage/shot-lists';

function nowIso() { return new Date().toISOString(); }
function id() { return `sl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`; }
function fileFor(shotListId) { return path.join(ROOT, `${shotListId}.json`); }

async function writeShotList(sl) {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(fileFor(sl.shotListId), JSON.stringify(sl, null, 2), 'utf8');
}

export async function getShotList(shotListId) {
  try { return { shotList: JSON.parse(await fs.readFile(fileFor(shotListId), 'utf8')) }; }
  catch { return { error: 'shot_list_not_found' }; }
}

async function loadSource({ scriptId = null, flowId = null, snapshotId = null, sessionId = null, packagePath = null } = {}) {
  const provided = [!!scriptId, !!flowId, !!snapshotId, !!sessionId, !!packagePath].filter(Boolean).length;
  if (provided === 0) return { error: 'missing_source_input' };
  if (provided > 1) return { error: 'conflicting_source_inputs' };

  if (scriptId) {
    const r = await getReviewedScript(scriptId);
    if (r.error) return r;
    const steps = (r.reviewed.sections || []).map((s) => ({
      index: s.stepIndex,
      title: s.title,
      intent: s.narrationText,
      annotations: s.annotations || [],
      stepDurationMs: s.timing?.estimatedDurationMs || 2200,
      overlay: { progressionMode: 'manual', emphasisMode: 'none' },
      screenshotBefore: s.visualRefs?.screenshotBefore || null,
      screenshotAfter: s.visualRefs?.screenshotAfter || null,
      highlight: s.visualRefs?.highlight || null,
      hotspots: (s.visualRefs?.hotspotIds || []).map((h) => ({ hotspotId: h }))
    }));
    return { sourceType: 'reviewed_script', sourceRef: { scriptId }, steps, narrationSections: r.reviewed.sections || [], reviewedEnvelope: r };
  }

  if (flowId) {
    const loaded = await loadFromFlow(flowId);
    if (loaded.error) return loaded;
    return { sourceType: 'reviewed_snapshot', sourceRef: { flowId }, steps: loaded.model.steps || [], narrationSections: [] };
  }
  if (snapshotId) {
    const loaded = await loadFromSnapshot(null, snapshotId);
    if (loaded.error) return loaded;
    return { sourceType: 'reviewed_snapshot', sourceRef: { snapshotId }, steps: loaded.model.steps || [], narrationSections: [] };
  }
  if (sessionId) {
    const s = await readSession(sessionId);
    if (!s?.model?.steps) return { error: 'session_not_found' };
    return { sourceType: 'player_session', sourceRef: { sessionId, interactionState: s.interactionState || null }, steps: s.model.steps || [], narrationSections: [] };
  }

  const loaded = await loadFromPackage(packagePath);
  if (loaded.error) return loaded;
  return { sourceType: 'reveal_package', sourceRef: { packagePath: path.basename(packagePath) }, steps: loaded.model.steps || [], narrationSections: [] };
}

export async function createShotList({ scriptId = null, flowId = null, snapshotId = null, sessionId = null, packagePath = null, styleProfile = null, publishReady = false, requireLatestReviewedSnapshotIntegrity = false, requireLatestTrustPublication = false } = {}) {
  const src = await loadSource({ scriptId, flowId, snapshotId, sessionId, packagePath });
  if (src.error) return src;
  if (!(src.steps || []).length) return { error: 'empty_scene_generation' };

  const sourceApprovalTrust = { publishGate: null, trustPublication: null };
  if (src.sourceType === 'reviewed_script' && src.reviewedEnvelope) {
    const gate = evaluatePublishGate({
      baseline: src.reviewedEnvelope.baseline,
      reviewed: src.reviewedEnvelope.reviewed,
      requireLatestReviewedSnapshotIntegrity
    });
    if (publishReady && !gate.canPublish) return { error: 'publish_gate_blocked', publishGate: gate };
    sourceApprovalTrust.publishGate = gate;

    if (requireLatestTrustPublication) {
      const tp = await getLatestTrustPublication(src.sourceRef.scriptId);
      if (tp.error) return { error: 'latest_trust_publication_missing' };
      if (!tp.trustPublication.chainHeadDigest) return { error: 'chain_head_digest_missing' };
      if (tp.trustPublication.trustPublicationSignatureStatus !== 'signed') return { error: 'latest_trust_publication_unsigned' };
      sourceApprovalTrust.trustPublication = {
        trustPublicationId: tp.trustPublication.trustPublicationId,
        chainHeadDigest: tp.trustPublication.chainHeadDigest,
        signatureStatus: tp.trustPublication.trustPublicationSignatureStatus
      };
    }
  }

  const derived = deriveScenesAndShots({ steps: src.steps, narrationSections: src.narrationSections });
  const scenes = mapSceneTimeline(derived.scenes);

  const shotList = {
    shotListId: id(),
    sourceType: src.sourceType,
    sourceRef: src.sourceRef,
    title: `Shot List — ${src.sourceType}`,
    description: 'Deterministic production shot plan',
    createdAt: nowIso(),
    shotListVersion: 'v1',
    styleProfile,
    totalEstimatedDurationMs: derived.totalEstimatedDurationMs,
    scenes,
    metadata: {
      sceneCount: scenes.length,
      shotCount: scenes.reduce((n, s) => n + (s.shots || []).length, 0),
      publishReadyMode: publishReady,
      sourceApprovalTrust
    }
  };

  await writeShotList(shotList);
  return { shotList };
}

function ms(ms) { const s = Math.round(Number(ms || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

export function exportShotList(shotList, format = 'json') {
  if (format === 'json') {
    return { contentType: 'application/json', filename: `${shotList.shotListId}.json`, content: JSON.stringify(shotList, null, 2) };
  }
  if (format !== 'markdown') return { error: 'invalid_export_format' };

  const lines = [];
  lines.push(`# ${shotList.title}`);
  lines.push('', `- Shot List ID: ${shotList.shotListId}`);
  lines.push(`- Source Type: ${shotList.sourceType}`);
  lines.push(`- Style Profile: ${shotList.styleProfile || 'n/a'}`);
  lines.push(`- Total Estimated Duration: ${ms(shotList.totalEstimatedDurationMs)}`);
  lines.push('', '## Scenes');

  for (const sc of shotList.scenes || []) {
    lines.push('', `### Scene ${sc.orderIndex + 1}: ${sc.title}`);
    lines.push(`- Objective: ${sc.objective || 'n/a'}`);
    lines.push(`- Step Range: ${sc.stepIndexRange?.start ?? 0}..${sc.stepIndexRange?.end ?? 0}`);
    lines.push(`- Timeline: ${ms(sc.timeline?.sceneStartMs)} - ${ms(sc.timeline?.sceneEndMs)}`);
    lines.push(`- Duration: ${ms(sc.estimatedDurationMs)}`);
    lines.push(`- Narration refs: ${(sc.narrationSectionRefs || []).join(', ') || 'none'}`);
    lines.push(`- Transition: in=${sc.transitionIn}, out=${sc.transitionOut}`);
    lines.push(`- Shots:`);
    for (const sh of sc.shots || []) {
      lines.push(`  - [${sh.shotType}] ${sh.title} (${ms(sh.startOffsetMs)} - ${ms(sh.endOffsetMs)})`);
      lines.push(`    - Asset: ${sh.sourceAssetRef || 'n/a'}`);
      lines.push(`    - Highlight: ${sh.highlightRef || 'n/a'}`);
      lines.push(`    - Hotspots: ${(sh.hotspotRefs || []).join(', ') || 'none'}`);
      lines.push(`    - Emphasis: ${sh.emphasis || 'none'}`);
      if (sh.notes) lines.push(`    - Notes: ${sh.notes}`);
    }
  }
  return { contentType: 'text/markdown; charset=utf-8', filename: `${shotList.shotListId}.md`, content: lines.join('\n') + '\n' };
}
