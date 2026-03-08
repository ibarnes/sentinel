import express from 'express';
import { createSession, appendEvents, closeSession } from '../services/ingestionService.js';
import { finalizeSessionToFlow } from '../services/normalizationService.js';
import { getFlow } from '../services/retrievalService.js';

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
  const found = await getFlow(flowId);
  if (!found) return res.status(404).json({ error: 'flow_not_found' });
  res.json(found);
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
    </aside>
    <main class="detail">
      <header>
        <h2 id="step-title">Step Detail</h2>
        <div class="actions">
          <button data-action="rename">Rename</button>
          <button data-action="reorder">Reorder</button>
          <button data-action="merge">Merge</button>
          <button data-action="delete">Delete</button>
          <button data-action="annotate">Annotate</button>
        </div>
      </header>
      <section class="meta" id="step-meta"></section>
      <section class="screenshots">
        <div><h4>Before</h4><img id="shot-before" alt="before" /></div>
        <div><h4>After</h4><img id="shot-after" alt="after" /></div>
        <div><h4>Highlight</h4><img id="shot-highlight" alt="highlight" /></div>
      </section>
    </main>
  </div>
  <script src="/reveal/editor/editor.js"></script>
</body>
</html>`);
});

export default router;
