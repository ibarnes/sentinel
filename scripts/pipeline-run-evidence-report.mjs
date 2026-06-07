#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const runDir = process.argv[2];
if (!runDir) {
  console.error('Usage: node scripts/pipeline-run-evidence-report.mjs <evidence-run-dir>');
  process.exit(1);
}

const abs = path.resolve(runDir);
const logPath = path.join(abs, 'auth-smoke.log');
const validPath = path.join(abs, 'valid-response.json');
const invalidPath = path.join(abs, 'invalid-response.json');
const auditPath = path.join(abs, 'pipeline-run-created.audit.json');
const manifestPath = path.join(abs, 'manifest.json');

const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
};

const manifest = readJson(manifestPath) || {};
const valid = readJson(validPath);
const invalid = readJson(invalidPath);
const audit = readJson(auditPath);
const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';

const saw201 = /HTTP 201/.test(log);
const saw400 = /HTTP 400/.test(log);
const validRun = valid?.run && typeof valid.run === 'object' ? valid.run : valid;
const runId = validRun?.runId || validRun?.run_id || validRun?.id || manifest.run_id || '';
const hasRunId = !!runId;
const hasStarted = String(validRun?.status || '').toLowerCase() === 'started';
const hasValidationError = !!(invalid && (invalid.error || invalid.message || invalid.details || invalid.validationErrors));
const auditMeta = audit?.meta && typeof audit.meta === 'object' ? audit.meta : {};
const hasAuditEvent = audit?.event_type === 'pipeline.run.created'
  && String(audit?.entity_id || '') === String(runId || '')
  && String(auditMeta.deckId || '') === String(validRun?.deckId || manifest.deck_id || '')
  && String(auditMeta.status || '').toLowerCase() === 'started';

const pass = saw201 && saw400 && hasRunId && hasStarted && hasValidationError && hasAuditEvent;
const status = pass ? 'PASS' : 'BLOCKED';
const outPath = path.join(abs, 'evidence-report.md');

const md = `# Pipeline Run Auth Smoke Evidence Report\n\n- **Status:** ${status}\n- **Generated (UTC):** ${new Date().toISOString()}\n- **Run Dir:** ${abs}\n- **Base URL:** ${manifest.base_url || 'unknown'}\n- **Deck ID:** ${manifest.deck_id || 'unknown'}\n\n## Checklist\n- [${saw201 ? 'x' : ' '}] Log shows HTTP 201 for valid request\n- [${saw400 ? 'x' : ' '}] Log shows HTTP 400 for invalid request\n- [${hasRunId ? 'x' : ' '}] Valid response includes runId\n- [${hasStarted ? 'x' : ' '}] Valid response status is started\n- [${hasValidationError ? 'x' : ' '}] Invalid response includes validation error payload\n- [${hasAuditEvent ? 'x' : ' '}] Audit artifact proves pipeline.run.created for returned runId/deckId\n\n## Artifacts\n- ${path.join(abs, 'auth-smoke.log')}\n- ${path.join(abs, 'valid-response.json')}\n- ${path.join(abs, 'invalid-response.json')}\n- ${path.join(abs, 'pipeline-run-created.audit.json')}\n- ${path.join(abs, 'manifest.json')}\n\n## Notes\n${pass ? '- Evidence is complete and review-ready.' : '- Evidence remains incomplete; missing credentialed output and/or audit artifact.'}\n`;

fs.writeFileSync(outPath, md);
console.log(JSON.stringify({ status, outPath }, null, 2));
