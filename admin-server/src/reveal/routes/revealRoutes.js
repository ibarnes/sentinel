import express from 'express';
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
import { integrityForStep, integrityRecomputeFlow } from '../services/replayIntegrityService.js';

const router = express.Router();

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
  const out = await integrityForStep(flowId, stepId, { persist: false });
  if (out.status === 'unreplayable_step') return res.status(200).json(out);
  res.json(out);
});

router.post('/api/flows/:flowId/replay-integrity/recompute', async (req, res) => {
  const flowId = String(req.params.flowId || '');
  const out = await integrityRecomputeFlow(flowId, { persist: true });
  if (out.error === 'flow_not_found') return res.status(404).json(out);
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
      <details class="compare" open>
        <summary>Coordinate Replay Debugger (read-only)</summary>
        <pre id="debugger-panel" class="dbg-pre"></pre>
      </details>
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

export default router;
