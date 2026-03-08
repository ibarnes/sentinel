import express from 'express';
import fs from 'fs/promises';
import multer from 'multer';
import { createSession, appendEvents, closeSession } from '../services/ingestionService.js';
import { finalizeSessionToFlow } from '../services/normalizationService.js';
import { getFlow } from '../services/retrievalService.js';
import {
  initReviewedFlow,
  updateStep,
  reorderSteps,
  mergeSteps,
  deleteStep,
  addAnnotation,
  getReview,
  replaceReview
} from '../services/reviewedFlowService.js';
import { getFlowCompare } from '../services/compareService.js';
import { buildStepCoordinateReplay } from '../services/coordinateReplayService.js';
import { loadFromFlow, loadFromSnapshot, loadFromPackage } from '../player/flowPlayerService.js';
import { applyPlaybackControl } from '../player/playbackController.js';
import { safeAssetPath } from '../player/assetResolverService.js';
import { createPlayerSession, getPlayerSession, listPlayerSessions, patchPlayerSession, deletePlayerSession, resumePlayerSession, resolveSessionAssetPath } from '../player/playerSessionService.js';
import { sweepPlayerSessions, startPlayerSessionSweeper } from '../player/playerSessionSweeper.js';
import { integrityForStep, integrityRecomputeFlow } from '../services/replayIntegrityService.js';
import { createSnapshot, listSnapshots, getSnapshot, verifySnapshotIntegrity, recomputeFlowSnapshotIntegrity } from '../services/snapshotService.js';
import { exportReviewedFlow, exportSnapshot } from '../services/exportService.js';
import { buildReviewedPackage, buildSnapshotPackage, getReviewedPackageVerificationMetadata, getSnapshotPackageVerificationMetadata } from '../services/packageService.js';
import { getSigningContext, verifyVerificationMetadata, getVerificationKeyset, verifyKeysetIntegrity, TRUST_PROFILES } from '../services/packageSigningService.js';

const router = express.Router();
const uploadPkg = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });
startPlayerSessionSweeper();

router.get('/api/verification/keyset', async (_req, res) => {
  const out = await getVerificationKeyset();
  res.json(out);
});

router.get('/api/verification/keyset/integrity', async (_req, res) => {
  const keyset = await getVerificationKeyset();
  const out = await verifyKeysetIntegrity(keyset);
  res.json(out);
});

router.get('/api/verification/trust-profiles', async (_req, res) => {
  res.json({ trustProfiles: Object.values(TRUST_PROFILES) });
});

router.get('/api/player/flows/:flowId', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const current = Number(req.query.step || 0);
  const control = String(req.query.control || 'none');
  const jumpTo = req.query.jumpTo != null ? Number(req.query.jumpTo) : null;
  const loaded = await loadFromFlow(flowId);
  if (loaded.error) return res.status(404).json(loaded);
  const playback = applyPlaybackControl(loaded.model.steps.length, current, control, jumpTo);
  res.json({ model: loaded.model, playback });
});

router.get('/api/player/snapshots/:snapshotId', async (req, res) => {
  const snapshotId = String(req.params.snapshotId || '');
  const flowId = String(req.query.flowId || '');
  const current = Number(req.query.step || 0);
  const control = String(req.query.control || 'none');
  const jumpTo = req.query.jumpTo != null ? Number(req.query.jumpTo) : null;
  const loaded = await loadFromSnapshot(flowId || null, snapshotId);
  if (loaded.error) return res.status(404).json(loaded);
  const playback = applyPlaybackControl(loaded.model.steps.length, current, control, jumpTo);
  res.json({ model: loaded.model, playback });
});

router.post('/api/player/packages', uploadPkg.single('package'), async (req, res) => {
  if (!req.file?.buffer?.length) return res.status(400).json({ error: 'missing_package_file' });
  const tmp = `/tmp/revealpkg-upload-${Date.now()}-${Math.random().toString(16).slice(2)}.zip`;
  await fs.writeFile(tmp, req.file.buffer);
  const loaded = await loadFromPackage(tmp);
  await fs.rm(tmp, { force: true });
  if (loaded.error) return res.status(400).json(loaded);
  const playback = applyPlaybackControl(loaded.model.steps.length, 0, 'none', null);
  res.json({ model: loaded.model, playback });
});

router.get('/api/player/packages/:token/assets/:kind/:file', async (req, res) => {
  const token = String(req.params.token || '');
  const kind = String(req.params.kind || 'screenshots');
  const file = String(req.params.file || '');
  const stem = file.replace(/\.(jpg|jpeg|png)$/i, '');
  const m = stem.match(/^(.*)-(before|after|highlight)$/);
  if (!m) return res.status(400).json({ error: 'invalid_asset_name' });
  const stepId = m[1];
  const k = m[2];
  if (kind === 'highlights' && k !== 'highlight') return res.status(400).json({ error: 'asset_kind_mismatch' });
  if (kind === 'screenshots' && !['before','after'].includes(k)) return res.status(400).json({ error: 'asset_kind_mismatch' });
  const p = safeAssetPath(token, k, stepId);
  try {
    await fs.access(p);
    res.sendFile(p);
  } catch {
    res.status(404).json({ error: 'asset_not_found' });
  }
});

router.get('/api/player/sessions', async (req, res) => {
  const out = await listPlayerSessions({
    status: req.query.status ? String(req.query.status) : null,
    sourceType: req.query.sourceType ? String(req.query.sourceType) : null,
    flowId: req.query.flowId ? String(req.query.flowId) : null,
    snapshotId: req.query.snapshotId ? String(req.query.snapshotId) : null,
    includeExpired: req.query.includeExpired ? String(req.query.includeExpired) : '0',
    recoverable: req.query.recoverable ? String(req.query.recoverable) : '0',
    sourceRetentionPolicy: req.query.sourceRetentionPolicy ? String(req.query.sourceRetentionPolicy) : null
  });
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/player/sessions/sweep', async (_req, res) => {
  const out = await sweepPlayerSessions();
  res.json(out);
});

router.post('/api/player/sessions', uploadPkg.single('package'), async (req, res) => {
  const flowId = req.body?.flowId || null;
  const snapshotId = req.body?.snapshotId || null;
  const packageBuffer = req.file?.buffer || null;
  const viewerMetadata = req.body?.viewerMetadata ? (() => { try { return JSON.parse(req.body.viewerMetadata); } catch { return null; } })() : null;
  const sourceRetentionPolicy = req.body?.sourceRetentionPolicy || 'ephemeral_only';
  const packageOriginalFilename = req.file?.originalname || null;

  const out = await createPlayerSession({ flowId, snapshotId, packageBuffer, viewerMetadata, sourceRetentionPolicy, packageOriginalFilename });
  if (out.error) {
    const code = ['missing_source_input','conflicting_source_inputs'].includes(out.error) ? 400 : 404;
    return res.status(code).json(out);
  }
  res.status(201).json(out);
});

router.get('/api/player/sessions/:sessionId', async (req, res) => {
  const out = await getPlayerSession(String(req.params.sessionId || ''));
  if (out.error === 'session_not_found') return res.status(404).json(out);
  res.json(out);
});

router.patch('/api/player/sessions/:sessionId', async (req, res) => {
  const out = await patchPlayerSession(String(req.params.sessionId || ''), {
    action: req.body?.action || null,
    jumpTo: req.body?.jumpTo,
    autoPlayEnabled: req.body?.autoPlayEnabled ?? null
  });
  if (['session_not_found'].includes(out.error)) return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.post('/api/player/sessions/:sessionId/resume', async (req, res) => {
  const out = await resumePlayerSession(String(req.params.sessionId || ''));
  if (out.error === 'session_not_found') return res.status(404).json(out);
  if (out.error) return res.status(400).json(out);
  res.json(out);
});

router.delete('/api/player/sessions/:sessionId', async (req, res) => {
  const out = await deletePlayerSession(String(req.params.sessionId || ''));
  if (out.error === 'session_not_found') return res.status(404).json(out);
  res.json(out);
});

router.get('/api/player/sessions/:sessionId/assets/:kind/:file', async (req, res) => {
  const out = await resolveSessionAssetPath(String(req.params.sessionId || ''), String(req.params.kind || ''), String(req.params.file || ''));
  if (out.error) return res.status(400).json(out);
  try {
    await fs.access(out.path);
    res.sendFile(out.path);
  } catch {
    res.status(404).json({ error: 'asset_not_found' });
  }
});

router.post('/api/sessions', async (req, res) => {
  const session = await createSession({ source: req.body?.source, meta: req.body?.meta || {} });
  res.status(201).json({ sessionId: session.sessionId, status: session.status, startedAt: session.startedAt });
});

router.post('/api/sessions/:id/events', async (req, res) => {
  const sessionId = String(req.params.id || '');
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  const out = await appendEvents(sessionId, events);
  res.json({ sessionId, ...out });
});

router.post('/api/sessions/:id/stop', async (req, res) => {
  const sessionId = String(req.params.id || '');
  const session = await closeSession(sessionId);
  if (!session) return res.status(404).json({ error: 'session_not_found' });
  const flow = await finalizeSessionToFlow(sessionId);
  res.json({ sessionId, status: session.status, flowId: flow?.id || null });
});

router.get('/api/flows/:id', async (req, res) => {
  const flowId = String(req.params.id || '');
  const version = String(req.query.version || 'preferred');
  const found = await getFlow(flowId, version);
  if (!found) return res.status(404).json({ error: 'flow_not_found' });
  res.json(found);
});

router.get('/api/flows/:id/compare', async (req, res) => {
  const flowId = String(req.params.id || '');
  const compare = await getFlowCompare(flowId);
  if (compare.error === 'baseline_not_found') return res.status(404).json({ error: 'baseline_not_found' });
  res.json(compare);
});

router.get('/api/flows/:flowId/steps/:stepId/coordinate-replay', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const stepId = String(req.params.stepId || '');
  const replay = await buildStepCoordinateReplay(flowId, stepId);
  if (replay.error === 'flow_not_found') return res.status(404).json(replay);
  if (replay.error === 'step_not_found') return res.status(404).json(replay);
  res.json(replay);
});

router.get('/api/flows/:flowId/steps/:stepId/replay-integrity', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const stepId = String(req.params.stepId || '');
  const includeDiff = String(req.query.includeDiff || '0') === '1';
  const out = await integrityForStep(flowId, stepId, { persist: false, includeDiff });
  if (out.status === 'unreplayable_step') return res.status(200).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/replay-integrity/recompute', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const includeDiff = String(req.query.includeDiff || '0') === '1';
  const out = await integrityRecomputeFlow(flowId, { persist: true, includeDiff });
  if (out.error === 'flow_not_found') return res.status(404).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/snapshots', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await createSnapshot(flowId, { createdBy: req.body?.createdBy || 'editor' });
  if (out.error === 'reviewed_flow_not_found') return res.status(404).json(out);
  if (out.error === 'snapshot_id_collision') return res.status(409).json(out);
  res.status(201).json(out);
});

router.get('/api/flows/:flowId/snapshots', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await listSnapshots(flowId);
  res.json(out);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const out = await getSnapshot(flowId, snapshotId);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  res.json(out);
});

router.get('/api/flows/:flowId/export/verification-metadata', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await getReviewedPackageVerificationMetadata(flowId);
  if (out.error === 'flow_not_found') return res.status(404).json(out);
  if (out.error) return res.status(500).json(out);
  res.json(out);
});

router.get('/api/flows/:flowId/export', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'package') {
    const pkg = await buildReviewedPackage(flowId);
    if (pkg.error === 'flow_not_found') return res.status(404).json(pkg);
    if (pkg.error) return res.status(500).json(pkg);
    res.setHeader('Content-Type', pkg.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
    return res.sendFile(pkg.archivePath, (err) => {
      setTimeout(() => { fs.rm(pkg.cleanupDir, { recursive: true, force: true }).catch(() => {}); }, 500);
      if (err) console.error(err);
    });
  }

  const out = await exportReviewedFlow(flowId, format);
  if (out.error === 'flow_not_found') return res.status(404).json(out);
  if (out.error === 'invalid_export_format') return res.status(400).json(out);
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.send(out.content);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId/export/verification-metadata', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const out = await getSnapshotPackageVerificationMetadata(flowId, snapshotId);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  if (out.error) return res.status(500).json(out);
  res.json(out);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId/export', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const format = String(req.query.format || 'json').toLowerCase();

  if (format === 'package') {
    const pkg = await buildSnapshotPackage(flowId, snapshotId);
    if (pkg.error === 'snapshot_not_found') return res.status(404).json(pkg);
    if (pkg.error) return res.status(500).json(pkg);
    res.setHeader('Content-Type', pkg.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.filename}"`);
    return res.sendFile(pkg.archivePath, (err) => {
      setTimeout(() => { fs.rm(pkg.cleanupDir, { recursive: true, force: true }).catch(() => {}); }, 500);
      if (err) console.error(err);
    });
  }

  const out = await exportSnapshot(flowId, snapshotId, format);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  if (out.error === 'invalid_export_format') return res.status(400).json(out);
  res.setHeader('Content-Type', out.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.send(out.content);
});

router.get('/api/flows/:flowId/snapshots/:snapshotId/integrity', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const snapshotId = String(req.params.snapshotId || '');
  const out = await verifySnapshotIntegrity(flowId, snapshotId);
  if (out.error === 'snapshot_not_found') return res.status(404).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/snapshots/integrity/recompute', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await recomputeFlowSnapshotIntegrity(flowId);
  res.json(out);
});

router.post('/api/revealpkg/verify', async (req, res) => {
  const meta = req.body || {};
  const ctx = await getSigningContext();
  const out = await verifyVerificationMetadata(meta, ctx);
  res.json(out);
});

router.post('/api/flows/:flowId/review/init', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const flow = await initReviewedFlow(flowId);
  if (!flow) return res.status(404).json({ error: 'flow_not_found' });
  res.status(201).json({ source: 'reviewed', flow });
});

router.patch('/api/flows/:flowId/steps/:stepId', async (req, res) => {
  const result = await updateStep(String(req.params.flowId), String(req.params.stepId), req.body || {});
  if (result.error === 'flow_not_found') return res.status(404).json({ error: result.error });
  if (result.error === 'step_not_found') return res.status(404).json({ error: result.error });
  if (result.error === 'invalid_title') return res.status(400).json({ error: result.error });
  res.json({ ok: true, flow: result.flow, step: result.step });
});

router.post('/api/flows/:flowId/steps/reorder', async (req, res) => {
  const orderedStepIds = Array.isArray(req.body?.orderedStepIds) ? req.body.orderedStepIds : [];
  const result = await reorderSteps(String(req.params.flowId), orderedStepIds);
  if (result.error) {
    const code = result.error === 'flow_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json({ ok: true, flow: result.flow });
});

router.post('/api/flows/:flowId/steps/merge', async (req, res) => {
  const stepIds = Array.isArray(req.body?.stepIds) ? req.body.stepIds : [];
  const merge = req.body?.merge || {};
  const result = await mergeSteps(String(req.params.flowId), stepIds, merge);
  if (result.error) {
    const code = result.error === 'flow_not_found' || result.error === 'step_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json({ ok: true, flow: result.flow, mergedStep: result.mergedStep });
});

router.delete('/api/flows/:flowId/steps/:stepId', async (req, res) => {
  const result = await deleteStep(String(req.params.flowId), String(req.params.stepId));
  if (result.error) {
    const code = result.error === 'flow_not_found' || result.error === 'step_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.json({ ok: true, flow: result.flow });
});

router.post('/api/flows/:flowId/steps/:stepId/annotations', async (req, res) => {
  const body = req.body || {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'invalid_annotation_payload' });
  if (!String(body.text || '').trim()) return res.status(400).json({ error: 'invalid_annotation_payload' });

  const result = await addAnnotation(String(req.params.flowId), String(req.params.stepId), body);
  if (result.error) {
    const code = result.error === 'flow_not_found' || result.error === 'step_not_found' ? 404 : 400;
    return res.status(code).json({ error: result.error });
  }
  res.status(201).json({ ok: true, flow: result.flow, annotation: result.annotation });
});

router.get('/api/flows/:flowId/review', async (req, res) => {
  const flow = await getReview(String(req.params.flowId));
  if (!flow) return res.status(404).json({ error: 'review_not_found' });
  res.json({ source: 'reviewed', flow });
});

router.put('/api/flows/:flowId/review', async (req, res) => {
  const result = await replaceReview(String(req.params.flowId), req.body || {});
  if (result.error === 'flow_not_found') return res.status(404).json({ error: result.error });
  res.json({ ok: true, source: 'reviewed', flow: result.flow });
});

router.get('/editor/:flowId', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reveal Flow Editor</title>
  <link rel="stylesheet" href="/reveal/editor/editor.css" />
</head>
<body>
  <div id="reveal-editor" data-flow-id="${flowId}">
    <aside class="timeline">
      <h3>Steps</h3>
      <ul id="timeline-list"></ul>
      <div class="timeline-actions">
        <button data-action="move-up">Move Up</button>
        <button data-action="move-down">Move Down</button>
        <button data-action="merge">Merge Selected</button>
      </div>
    </aside>
    <main class="detail">
      <header>
        <h2 id="step-title">Step Detail</h2>
        <div class="actions">
          <button data-action="rename">Rename</button>
          <button data-action="delete">Delete</button>
          <button data-action="annotate">Annotate</button>
          <button data-action="reload">Reload</button>
          <button data-action="compare-toggle">Compare: On</button>
          <button data-action="integrity-recompute">Recompute Integrity</button>
          <button data-action="snapshot-create">Create Snapshot</button>
          <button data-action="export-reviewed-json">Export Reviewed JSON</button>
          <button data-action="export-reviewed-md">Export Reviewed MD</button>
          <button data-action="export-reviewed-package">Export Reviewed Package</button>
        </div>
      </header>
      <section class="meta" id="step-meta"></section>
      <section class="compare" id="compare-panel"></section>
      <section class="screenshots">
        <div><h4>Before</h4><img id="shot-before" alt="before" /></div>
        <div><h4>After</h4><img id="shot-after" alt="after" /></div>
        <div><h4>Highlight</h4><img id="shot-highlight" alt="highlight" /></div>
      </section>
      <section id="coord-inspector" class="compare"></section>
      <details class="compare">
        <summary>Coordinate Replay Debugger (read-only)</summary>
        <pre id="debugger-panel" class="dbg-pre"></pre>
      </details>
      <section class="compare">
        <h4>Snapshots</h4>
        <select id="snapshot-select"></select>
        <div class="actions">
          <button data-action="snapshot-refresh">Refresh Snapshots</button>
          <button data-action="snapshot-integrity-recompute">Recompute Snapshot Integrity</button>
          <button data-action="export-snapshot-json">Export Snapshot JSON</button>
          <button data-action="export-snapshot-md">Export Snapshot MD</button>
          <button data-action="export-snapshot-package">Export Snapshot Package</button>
        </div>
        <pre id="snapshot-summary" class="dbg-pre"></pre>
      </section>
      <section>
        <h4>Annotations</h4>
        <ul id="annotations"></ul>
      </section>
    </main>
  </div>
  <script src="/reveal/editor/editor.js"></script>
</body>
</html>`);
});

router.get('/player/:flowId', async (req, res) => {
  res.type('html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reveal Flow Player</title>
  <link rel="stylesheet" href="/reveal/player/player.css" />
</head>
<body>
  <div class="wrap">
    <section class="viewer">
      <h2 id="flow">Reveal Player</h2>
      <div id="resume-note" class="small"></div>
      <div class="stage"><img id="shot" alt="step" /><div id="hotspots"></div></div>
      <div class="overlay" id="overlay"></div>
      <div class="ctrls">
        <button id="restart">Restart</button>
        <button id="prev">Previous</button>
        <button id="next">Next</button>
        <button id="dismiss">Dismiss Overlay</button>
        <button id="auto">Auto Play</button>
      </div>
    </section>
    <aside class="panel">
      <h3 id="title">Step</h3>
      <div id="meta" class="small"></div>
      <p id="intent"></p>
      <h4>Annotations</h4>
      <ul id="annotations"></ul>
    </aside>
  </div>
  <script src="/reveal/player/player.js"></script>
</body>
</html>`);
});

export default router;
